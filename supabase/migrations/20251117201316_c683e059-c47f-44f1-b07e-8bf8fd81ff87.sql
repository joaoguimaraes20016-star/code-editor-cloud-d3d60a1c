-- Drop the broken webhook trigger
DROP TRIGGER IF EXISTS trigger_notify_auto_create_tasks ON appointments;
DROP FUNCTION IF EXISTS notify_auto_create_tasks();

-- Create a comprehensive database function that handles task creation directly
CREATE OR REPLACE FUNCTION auto_create_confirmation_tasks()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_team_settings RECORD;
  v_confirmation_config JSONB;
  v_first_confirmation JSONB;
  v_due_at TIMESTAMPTZ;
  v_assigned_to UUID;
  v_assigned_role TEXT;
  v_routing_mode TEXT;
  v_hours_until_appt NUMERIC;
  v_min_notice_hours NUMERIC;
  v_fallback_minutes NUMERIC;
  v_active_members UUID[];
  v_now TIMESTAMPTZ;
BEGIN
  -- Only proceed for NEW appointments
  IF NEW.status != 'NEW' THEN
    RETURN NEW;
  END IF;

  v_now := NOW();

  -- Get team settings
  SELECT 
    auto_create_tasks,
    confirmation_flow_config,
    minimum_booking_notice_hours,
    fallback_confirmation_minutes,
    mrr_task_assignment
  INTO v_team_settings
  FROM teams
  WHERE id = NEW.team_id;

  -- If auto_create_tasks is explicitly disabled, skip
  IF v_team_settings.auto_create_tasks = FALSE THEN
    RETURN NEW;
  END IF;

  -- Get confirmation flow config
  v_confirmation_config := COALESCE(v_team_settings.confirmation_flow_config, 
    '[{"sequence":1,"hours_before":24,"label":"24h Before","assigned_role":"setter","assignment_mode":"round_robin","enabled":true}]'::jsonb
  );

  -- Get first enabled confirmation step
  SELECT conf INTO v_first_confirmation
  FROM jsonb_array_elements(v_confirmation_config) AS conf
  WHERE (conf->>'enabled')::boolean = true
  ORDER BY (conf->>'sequence')::int
  LIMIT 1;

  -- If no enabled confirmations, skip
  IF v_first_confirmation IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate hours until appointment
  v_hours_until_appt := EXTRACT(EPOCH FROM (NEW.start_at_utc - v_now)) / 3600;
  v_min_notice_hours := COALESCE(v_team_settings.minimum_booking_notice_hours, 24);
  v_fallback_minutes := COALESCE(v_team_settings.fallback_confirmation_minutes, 60);

  -- Determine due_at based on booking notice
  IF v_hours_until_appt < v_min_notice_hours THEN
    -- Last-minute booking: use fallback
    v_due_at := NEW.start_at_utc - (v_fallback_minutes || ' minutes')::interval;
    
    -- If even fallback is in the past, set to now
    IF v_due_at < v_now THEN
      v_due_at := v_now;
    END IF;
  ELSE
    -- Normal booking: use configured hours_before
    v_due_at := NEW.start_at_utc - ((v_first_confirmation->>'hours_before')::numeric || ' hours')::interval;
  END IF;

  -- Get assignment settings
  v_assigned_role := COALESCE(v_first_confirmation->>'assigned_role', 'setter');
  v_routing_mode := COALESCE(v_first_confirmation->>'assignment_mode', 'round_robin');

  -- Handle assignment
  IF v_routing_mode = 'individual' AND v_first_confirmation->>'assigned_user_id' IS NOT NULL THEN
    -- Specific user assignment
    v_assigned_to := (v_first_confirmation->>'assigned_user_id')::uuid;
  ELSIF v_routing_mode = 'role' THEN
    -- Assign to all active members of the role (leave unassigned for manual claim)
    v_assigned_to := NULL;
  ELSE
    -- Round-robin: find active member of role with fewest pending tasks
    IF v_assigned_role = 'setter' AND NEW.setter_id IS NOT NULL THEN
      -- Use appointment's setter if available
      v_assigned_to := NEW.setter_id;
    ELSIF v_assigned_role = 'closer' AND NEW.closer_id IS NOT NULL THEN
      -- Use appointment's closer if available
      v_assigned_to := NEW.closer_id;
    ELSE
      -- Find active team member with fewest tasks
      SELECT tm.user_id INTO v_assigned_to
      FROM team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.role = v_assigned_role
        AND tm.is_active = true
      ORDER BY (
        SELECT COUNT(*)
        FROM confirmation_tasks ct
        WHERE ct.team_id = NEW.team_id
          AND ct.assigned_to = tm.user_id
          AND ct.status = 'pending'
      ) ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Create the confirmation task
  INSERT INTO confirmation_tasks (
    team_id,
    appointment_id,
    task_type,
    status,
    due_at,
    assigned_to,
    assigned_at,
    auto_return_at,
    assigned_role,
    routing_mode,
    confirmation_sequence,
    required_confirmations
  ) VALUES (
    NEW.team_id,
    NEW.id,
    'call_confirmation',
    'pending',
    v_due_at,
    v_assigned_to,
    CASE WHEN v_assigned_to IS NOT NULL THEN v_now ELSE NULL END,
    CASE WHEN v_assigned_to IS NOT NULL THEN v_now + interval '2 hours' ELSE NULL END,
    v_assigned_role,
    v_routing_mode,
    1,
    jsonb_array_length(v_confirmation_config)
  );

  -- Check for upcoming MRR renewals (within next 7 days)
  INSERT INTO mrr_follow_up_tasks (team_id, mrr_schedule_id, due_date, status)
  SELECT 
    NEW.team_id,
    ms.id,
    ms.next_renewal_date,
    'due'
  FROM mrr_schedules ms
  WHERE ms.team_id = NEW.team_id
    AND ms.status = 'active'
    AND ms.next_renewal_date BETWEEN CURRENT_DATE AND (CURRENT_DATE + interval '7 days')
    AND NOT EXISTS (
      SELECT 1 FROM mrr_follow_up_tasks mft
      WHERE mft.mrr_schedule_id = ms.id
        AND mft.due_date = ms.next_renewal_date
    );

  -- Log activity
  INSERT INTO activity_logs (
    team_id,
    appointment_id,
    actor_name,
    action_type,
    note
  ) VALUES (
    NEW.team_id,
    NEW.id,
    'System',
    'Task Created',
    CASE 
      WHEN v_assigned_to IS NOT NULL THEN 'Confirmation task auto-assigned'
      ELSE 'Confirmation task created in queue'
    END
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block appointment creation
  RAISE WARNING 'Failed to create confirmation task: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER trigger_auto_create_confirmation_tasks
  AFTER INSERT ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'NEW')
  EXECUTE FUNCTION auto_create_confirmation_tasks();