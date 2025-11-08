-- Fix the create_task_with_assignment function to remove reference to non-existent column

CREATE OR REPLACE FUNCTION create_task_with_assignment(
  p_team_id UUID,
  p_appointment_id UUID,
  p_task_type task_type,
  p_follow_up_date DATE DEFAULT NULL,
  p_follow_up_reason TEXT DEFAULT NULL,
  p_reschedule_date DATE DEFAULT NULL,
  p_preferred_role TEXT DEFAULT 'auto'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_members UUID[];
  assigned_member UUID;
  new_task_id UUID;
  existing_setter UUID;
  existing_closer UUID;
  appointment_start TIMESTAMPTZ;
  calculated_due_at TIMESTAMPTZ;
  target_role text;
  team_flow_config JSONB;
  team_default_routing JSONB;
  first_enabled_conf JSONB;
BEGIN
  -- Get appointment details
  SELECT setter_id, closer_id, start_at_utc 
  INTO existing_setter, existing_closer, appointment_start
  FROM appointments
  WHERE id = p_appointment_id;

  -- Get team configuration
  SELECT confirmation_flow_config, default_task_routing
  INTO team_flow_config, team_default_routing
  FROM teams
  WHERE id = p_team_id;

  -- Determine target role based on task type and configuration
  IF p_task_type = 'call_confirmation' THEN
    -- Get first enabled confirmation from flow config
    SELECT conf INTO first_enabled_conf
    FROM jsonb_array_elements(team_flow_config) AS conf
    WHERE (conf->>'enabled')::boolean = true
    ORDER BY (conf->>'sequence')::int
    LIMIT 1;
    
    target_role := COALESCE(first_enabled_conf->>'assigned_role', 'setter');
    calculated_due_at := appointment_start - 
      ((first_enabled_conf->>'hours_before')::numeric * INTERVAL '1 hour');
  ELSIF p_task_type = 'follow_up' THEN
    target_role := COALESCE(team_default_routing->>'follow_up', 'closer');
  ELSIF p_task_type = 'reschedule' THEN
    target_role := COALESCE(team_default_routing->>'reschedule', 'closer');
  ELSE
    target_role := 'closer'; -- fallback
  END IF;

  -- Override with preferred role if specified
  IF p_preferred_role != 'auto' THEN
    target_role := p_preferred_role;
  END IF;

  -- Try to assign to existing team member on appointment first
  IF target_role = 'setter' AND existing_setter IS NOT NULL THEN
    assigned_member := existing_setter;
  ELSIF target_role = 'closer' AND existing_closer IS NOT NULL THEN
    assigned_member := existing_closer;
  ELSIF target_role IN ('admin', 'offer_owner') THEN
    -- Get active members of the target role
    SELECT ARRAY_AGG(user_id) INTO active_members
    FROM team_members
    WHERE team_id = p_team_id
      AND role = target_role
      AND is_active = true;

    -- Round-robin assignment among role members
    IF active_members IS NOT NULL AND array_length(active_members, 1) > 0 THEN
      SELECT tm.user_id INTO assigned_member
      FROM team_members tm
      WHERE tm.team_id = p_team_id
        AND tm.role = target_role
        AND tm.is_active = true
      ORDER BY (
        SELECT COUNT(*)
        FROM confirmation_tasks ct
        WHERE ct.team_id = p_team_id
          AND ct.assigned_to = tm.user_id
          AND ct.status = 'pending'
      ) ASC
      LIMIT 1;
    END IF;
  ELSE
    -- Get active members of target role (setter/closer)
    SELECT ARRAY_AGG(user_id) INTO active_members
    FROM team_members
    WHERE team_id = p_team_id
      AND role = target_role
      AND is_active = true;

    -- Round-robin assignment
    IF active_members IS NOT NULL AND array_length(active_members, 1) > 0 THEN
      SELECT tm.user_id INTO assigned_member
      FROM team_members tm
      WHERE tm.team_id = p_team_id
        AND tm.role = target_role
        AND tm.is_active = true
      ORDER BY (
        SELECT COUNT(*)
        FROM confirmation_tasks ct
        WHERE ct.team_id = p_team_id
          AND ct.assigned_to = tm.user_id
          AND ct.status = 'pending'
      ) ASC
      LIMIT 1;
    END IF;
  END IF;

  -- Create the task
  INSERT INTO confirmation_tasks (
    team_id,
    appointment_id,
    assigned_to,
    assigned_at,
    auto_return_at,
    status,
    task_type,
    follow_up_date,
    follow_up_reason,
    reschedule_date,
    due_at,
    assigned_role
  ) VALUES (
    p_team_id,
    p_appointment_id,
    assigned_member,
    CASE WHEN assigned_member IS NOT NULL THEN NOW() ELSE NULL END,
    CASE WHEN assigned_member IS NOT NULL THEN NOW() + INTERVAL '2 hours' ELSE NULL END,
    'pending',
    p_task_type,
    p_follow_up_date,
    p_follow_up_reason,
    p_reschedule_date,
    calculated_due_at,
    target_role
  )
  RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$$;