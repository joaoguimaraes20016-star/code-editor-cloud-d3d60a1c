-- Create function to cleanup confirmation tasks
CREATE OR REPLACE FUNCTION public.cleanup_confirmation_tasks(
  p_appointment_id uuid,
  p_reason text DEFAULT 'Status changed'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete pending and in-progress confirmation tasks
  DELETE FROM confirmation_tasks
  WHERE appointment_id = p_appointment_id
    AND status IN ('pending', 'in_progress');
  
  -- Log the cleanup
  INSERT INTO activity_logs (
    team_id,
    appointment_id,
    actor_name,
    action_type,
    note
  )
  SELECT 
    a.team_id,
    a.id,
    'System',
    'Tasks Cleaned',
    'Confirmation tasks removed: ' || p_reason
  FROM appointments a
  WHERE a.id = p_appointment_id;
END;
$$;

-- Update close_deal_transaction to cleanup tasks
CREATE OR REPLACE FUNCTION public.close_deal_transaction(
  p_appointment_id uuid,
  p_closer_id uuid,
  p_cc_amount numeric,
  p_mrr_amount numeric,
  p_mrr_months integer,
  p_product_name text,
  p_notes text DEFAULT NULL,
  p_closer_name text DEFAULT NULL,
  p_closer_commission_pct numeric DEFAULT 10.0,
  p_setter_commission_pct numeric DEFAULT 5.0
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_appointment record;
  v_sale_id uuid;
  v_total_revenue numeric;
  v_closer_commission numeric;
  v_setter_commission numeric;
  v_result json;
  v_month_date date;
  v_existing_sale_id uuid;
BEGIN
  SELECT * INTO v_appointment
  FROM appointments
  WHERE id = p_appointment_id
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Appointment not found: %', p_appointment_id;
  END IF;
  
  IF v_appointment.status = 'CLOSED' THEN
    RAISE EXCEPTION 'Appointment already closed';
  END IF;
  
  v_total_revenue := p_cc_amount + (p_mrr_amount * COALESCE(p_mrr_months, 0));
  v_closer_commission := ROUND((v_total_revenue * p_closer_commission_pct / 100)::numeric, 2);
  v_setter_commission := ROUND((v_total_revenue * p_setter_commission_pct / 100)::numeric, 2);
  
  UPDATE appointments
  SET 
    status = 'CLOSED',
    pipeline_stage = 'won',
    cc_collected = p_cc_amount,
    mrr_amount = p_mrr_amount,
    mrr_months = p_mrr_months,
    revenue = v_total_revenue,
    product_name = p_product_name,
    updated_at = now()
  WHERE id = p_appointment_id;
  
  -- Cleanup confirmation tasks after status change
  PERFORM cleanup_confirmation_tasks(p_appointment_id, 'Deal closed');
  
  SELECT id INTO v_existing_sale_id
  FROM sales
  WHERE customer_name = v_appointment.lead_name
    AND date = v_appointment.start_at_utc::date
    AND sales_rep = COALESCE(p_closer_name, v_appointment.closer_name)
  LIMIT 1;
  
  IF v_existing_sale_id IS NOT NULL THEN
    UPDATE sales
    SET
      revenue = v_total_revenue,
      commission = v_closer_commission,
      setter_commission = v_setter_commission,
      product_name = p_product_name,
      status = 'Closed Won',
      updated_at = now()
    WHERE id = v_existing_sale_id;
    
    v_sale_id := v_existing_sale_id;
  ELSE
    INSERT INTO sales (
      team_id,
      customer_name,
      sales_rep,
      setter,
      offer_owner,
      product_name,
      date,
      revenue,
      commission,
      setter_commission,
      status
    ) VALUES (
      v_appointment.team_id,
      v_appointment.lead_name,
      COALESCE(p_closer_name, v_appointment.closer_name),
      v_appointment.setter_name,
      v_appointment.closer_name,
      p_product_name,
      v_appointment.start_at_utc::date,
      v_total_revenue,
      v_closer_commission,
      v_setter_commission,
      'Closed Won'
    )
    RETURNING id INTO v_sale_id;
  END IF;
  
  IF p_mrr_amount > 0 AND p_mrr_months > 0 THEN
    DELETE FROM mrr_commissions
    WHERE appointment_id = p_appointment_id;
    
    FOR i IN 0..(p_mrr_months - 1) LOOP
      v_month_date := (v_appointment.start_at_utc::date + (i || ' months')::interval)::date;
      
      INSERT INTO mrr_commissions (
        team_id,
        sale_id,
        appointment_id,
        team_member_id,
        team_member_name,
        prospect_name,
        prospect_email,
        role,
        mrr_amount,
        commission_percentage,
        commission_amount,
        month_date
      ) VALUES (
        v_appointment.team_id,
        v_sale_id,
        p_appointment_id,
        p_closer_id,
        COALESCE(p_closer_name, v_appointment.closer_name),
        v_appointment.lead_name,
        v_appointment.lead_email,
        'closer',
        p_mrr_amount,
        p_closer_commission_pct,
        ROUND((p_mrr_amount * p_closer_commission_pct / 100)::numeric, 2),
        v_month_date
      );
      
      IF v_appointment.setter_id IS NOT NULL THEN
        INSERT INTO mrr_commissions (
          team_id,
          sale_id,
          appointment_id,
          team_member_id,
          team_member_name,
          prospect_name,
          prospect_email,
          role,
          mrr_amount,
          commission_percentage,
          commission_amount,
          month_date
        ) VALUES (
          v_appointment.team_id,
          v_sale_id,
          p_appointment_id,
          v_appointment.setter_id,
          v_appointment.setter_name,
          v_appointment.lead_name,
          v_appointment.lead_email,
          'setter',
          p_mrr_amount,
          p_setter_commission_pct,
          ROUND((p_mrr_amount * p_setter_commission_pct / 100)::numeric, 2),
          v_month_date
        );
      END IF;
    END LOOP;
    
    INSERT INTO mrr_schedules (
      team_id,
      appointment_id,
      client_name,
      client_email,
      mrr_amount,
      first_charge_date,
      next_renewal_date,
      status,
      notes
    ) VALUES (
      v_appointment.team_id,
      p_appointment_id,
      v_appointment.lead_name,
      v_appointment.lead_email,
      p_mrr_amount,
      v_appointment.start_at_utc::date,
      (v_appointment.start_at_utc::date + '1 month'::interval)::date,
      'active',
      p_notes
    )
    ON CONFLICT DO NOTHING;
  END IF;
  
  INSERT INTO activity_logs (
    team_id,
    appointment_id,
    actor_id,
    actor_name,
    action_type,
    note
  ) VALUES (
    v_appointment.team_id,
    p_appointment_id,
    p_closer_id,
    COALESCE(p_closer_name, 'Closer'),
    'Status Changed',
    'Deal closed via transaction - CC: $' || p_cc_amount || ', MRR: $' || p_mrr_amount || ' x ' || COALESCE(p_mrr_months, 0) || ' months'
  );
  
  v_result := json_build_object(
    'success', true,
    'sale_id', v_sale_id,
    'appointment_id', p_appointment_id,
    'total_revenue', v_total_revenue,
    'closer_commission', v_closer_commission,
    'setter_commission', v_setter_commission
  );
  
  RETURN v_result;
  
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Transaction failed: %', SQLERRM;
END;
$$;

-- Create trigger function for automatic cleanup
CREATE OR REPLACE FUNCTION public.auto_cleanup_confirmation_tasks()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If status changed to terminal state, cleanup tasks
  IF NEW.status IN ('CLOSED', 'CANCELLED', 'RESCHEDULED', 'NO_SHOW') 
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    
    DELETE FROM confirmation_tasks
    WHERE appointment_id = NEW.id
      AND status IN ('pending', 'in_progress');
      
  END IF;
  
  -- If pipeline stage changed to terminal stage, cleanup tasks
  IF NEW.pipeline_stage IN ('won', 'closed', 'cancelled', 'no_show', 'lost', 'rescheduled')
     AND (OLD.pipeline_stage IS DISTINCT FROM NEW.pipeline_stage) THEN
    
    DELETE FROM confirmation_tasks
    WHERE appointment_id = NEW.id
      AND status IN ('pending', 'in_progress');
      
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger on appointments table
DROP TRIGGER IF EXISTS cleanup_tasks_on_status_change ON appointments;
CREATE TRIGGER cleanup_tasks_on_status_change
  AFTER UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION auto_cleanup_confirmation_tasks();