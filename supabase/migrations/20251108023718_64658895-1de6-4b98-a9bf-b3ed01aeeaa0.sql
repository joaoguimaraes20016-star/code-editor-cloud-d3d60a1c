-- Update create_task_with_assignment function to support admin and offer_owner roles
CREATE OR REPLACE FUNCTION public.create_task_with_assignment(
  p_team_id uuid,
  p_appointment_id uuid,
  p_task_type task_type,
  p_follow_up_date date DEFAULT NULL,
  p_follow_up_reason text DEFAULT NULL,
  p_reschedule_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    target_role := COALESCE(team_default_routing->>'follow_up', 'setter');
  ELSIF p_task_type = 'reschedule' THEN
    target_role := COALESCE(team_default_routing->>'reschedule', 'setter');
  ELSE
    target_role := 'setter'; -- fallback
  END IF;

  -- Try to assign to existing team member on appointment first
  IF target_role = 'setter' AND existing_setter IS NOT NULL THEN
    assigned_member := existing_setter;
  ELSIF target_role = 'closer' AND existing_closer IS NOT NULL THEN
    assigned_member := existing_closer;
  ELSIF target_role = 'admin' THEN
    -- Get active admins
    SELECT ARRAY_AGG(user_id) INTO active_members
    FROM team_members
    WHERE team_id = p_team_id
      AND role = 'admin'
      AND is_active = true;

    -- Round-robin assignment among admins
    IF active_members IS NOT NULL AND array_length(active_members, 1) > 0 THEN
      SELECT tm.user_id INTO assigned_member
      FROM team_members tm
      WHERE tm.team_id = p_team_id
        AND tm.role = 'admin'
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
  ELSIF target_role = 'offer_owner' THEN
    -- Get active offer_owners
    SELECT ARRAY_AGG(user_id) INTO active_members
    FROM team_members
    WHERE team_id = p_team_id
      AND role = 'offer_owner'
      AND is_active = true;

    -- Round-robin assignment among offer_owners
    IF active_members IS NOT NULL AND array_length(active_members, 1) > 0 THEN
      SELECT tm.user_id INTO assigned_member
      FROM team_members tm
      WHERE tm.team_id = p_team_id
        AND tm.role = 'offer_owner'
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
    -- Get active members of target role
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
    assigned_role,
    routing_mode
  ) VALUES (
    p_team_id,
    p_appointment_id,
    assigned_member,
    CASE WHEN assigned_member IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN assigned_member IS NOT NULL THEN now() + interval '2 hours' ELSE NULL END,
    'pending',
    p_task_type,
    p_follow_up_date,
    p_follow_up_reason,
    p_reschedule_date,
    calculated_due_at,
    target_role,
    'flow_config'
  ) RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$function$;

-- Update auto_create_confirmation_task trigger to support admin and offer_owner roles
CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_setters UUID[];
  active_closers UUID[];
  active_admins UUID[];
  active_offer_owners UUID[];
  assigned_user_id UUID;
  assigned_role_type text;
  calculated_due_at TIMESTAMPTZ;
  team_flow_config JSONB;
  first_enabled_conf JSONB;
  required_conf_count INTEGER;
BEGIN
  -- Only create call confirmation tasks for NEW appointments
  IF NEW.status != 'NEW' THEN
    RETURN NEW;
  END IF;

  -- Check if a confirmation task already exists
  IF EXISTS (
    SELECT 1 FROM confirmation_tasks 
    WHERE appointment_id = NEW.id 
    AND task_type = 'call_confirmation'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get team's flow configuration
  SELECT confirmation_flow_config
  INTO team_flow_config
  FROM teams
  WHERE id = NEW.team_id;

  -- Count enabled confirmations
  SELECT COUNT(*) INTO required_conf_count
  FROM jsonb_array_elements(team_flow_config) AS conf
  WHERE (conf->>'enabled')::boolean = true;

  -- If no confirmations enabled, don't create task
  IF required_conf_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Get first enabled confirmation
  SELECT conf INTO first_enabled_conf
  FROM jsonb_array_elements(team_flow_config) AS conf
  WHERE (conf->>'enabled')::boolean = true
  ORDER BY (conf->>'sequence')::int
  LIMIT 1;

  -- Calculate due_at using first enabled confirmation
  calculated_due_at := NEW.start_at_utc - 
    ((first_enabled_conf->>'hours_before')::numeric * INTERVAL '1 hour');

  -- Determine assigned role from configuration
  assigned_role_type := first_enabled_conf->>'assigned_role';

  -- Don't create task if role is "off"
  IF assigned_role_type = 'off' THEN
    RETURN NEW;
  END IF;

  -- Assign to appropriate role
  IF assigned_role_type = 'setter' THEN
    IF NEW.setter_id IS NOT NULL THEN
      assigned_user_id := NEW.setter_id;
    ELSE
      -- Get active setters in rotation
      SELECT ARRAY_AGG(tm.user_id) INTO active_setters
      FROM team_members tm
      LEFT JOIN setter_rotation_settings srs ON srs.setter_id = tm.user_id AND srs.team_id = tm.team_id
      WHERE tm.team_id = NEW.team_id
        AND tm.role = 'setter'
        AND tm.is_active = true
        AND (srs.is_in_rotation IS NULL OR srs.is_in_rotation = true);

      IF active_setters IS NOT NULL AND array_length(active_setters, 1) > 0 THEN
        -- Round-robin to setter with fewest tasks
        SELECT tm.user_id INTO assigned_user_id
        FROM team_members tm
        WHERE tm.team_id = NEW.team_id
          AND tm.role = 'setter'
          AND tm.is_active = true
          AND tm.user_id = ANY(active_setters)
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
  ELSIF assigned_role_type = 'closer' THEN
    IF NEW.closer_id IS NOT NULL THEN
      assigned_user_id := NEW.closer_id;
    ELSE
      -- Get active closers
      SELECT ARRAY_AGG(tm.user_id) INTO active_closers
      FROM team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.role = 'closer'
        AND tm.is_active = true;

      IF active_closers IS NOT NULL AND array_length(active_closers, 1) > 0 THEN
        -- Round-robin to closer with fewest tasks
        SELECT tm.user_id INTO assigned_user_id
        FROM team_members tm
        WHERE tm.team_id = NEW.team_id
          AND tm.role = 'closer'
          AND tm.is_active = true
          AND tm.user_id = ANY(active_closers)
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
  ELSIF assigned_role_type = 'admin' THEN
    -- Get active admins
    SELECT ARRAY_AGG(tm.user_id) INTO active_admins
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.role = 'admin'
      AND tm.is_active = true;

    IF active_admins IS NOT NULL AND array_length(active_admins, 1) > 0 THEN
      -- Round-robin to admin with fewest tasks
      SELECT tm.user_id INTO assigned_user_id
      FROM team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.role = 'admin'
        AND tm.is_active = true
        AND tm.user_id = ANY(active_admins)
      ORDER BY (
        SELECT COUNT(*)
        FROM confirmation_tasks ct
        WHERE ct.team_id = NEW.team_id
          AND ct.assigned_to = tm.user_id
          AND ct.status = 'pending'
      ) ASC
      LIMIT 1;
    END IF;
  ELSIF assigned_role_type = 'offer_owner' THEN
    -- Get active offer_owners
    SELECT ARRAY_AGG(tm.user_id) INTO active_offer_owners
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.role = 'offer_owner'
      AND tm.is_active = true;

    IF active_offer_owners IS NOT NULL AND array_length(active_offer_owners, 1) > 0 THEN
      -- Round-robin to offer_owner with fewest tasks
      SELECT tm.user_id INTO assigned_user_id
      FROM team_members tm
      WHERE tm.team_id = NEW.team_id
        AND tm.role = 'offer_owner'
        AND tm.is_active = true
        AND tm.user_id = ANY(active_offer_owners)
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

  -- Update appointment with assigned user
  IF assigned_user_id IS NOT NULL THEN
    IF assigned_role_type = 'setter' AND NEW.setter_id IS NULL THEN
      UPDATE appointments 
      SET 
        setter_id = assigned_user_id,
        assignment_source = 'auto_assign'
      WHERE id = NEW.id;
    ELSIF assigned_role_type = 'closer' AND NEW.closer_id IS NULL THEN
      UPDATE appointments 
      SET 
        closer_id = assigned_user_id,
        assignment_source = 'auto_assign'
      WHERE id = NEW.id;
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
    due_at,
    required_confirmations,
    confirmation_sequence,
    assigned_role,
    routing_mode
  ) VALUES (
    NEW.team_id,
    NEW.id,
    assigned_user_id,
    CASE WHEN assigned_user_id IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN assigned_user_id IS NOT NULL THEN now() + interval '2 hours' ELSE NULL END,
    'pending',
    'call_confirmation',
    calculated_due_at,
    required_conf_count,
    1,
    assigned_role_type,
    'flow_config'
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RETURN NEW;
END;
$function$;