-- Add task routing configuration columns to teams table
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS confirmation_routing_mode text DEFAULT 'setter_only' 
  CHECK (confirmation_routing_mode IN ('setter_only', 'closer_only', 'sequential_setter_then_closer', 'custom')),
ADD COLUMN IF NOT EXISTS confirmation_setter_count integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS mrr_task_assignment text DEFAULT 'closer_who_closed'
  CHECK (mrr_task_assignment IN ('closer_who_closed', 'original_setter', 'appointment_closer', 'custom_role')),
ADD COLUMN IF NOT EXISTS task_routing_config jsonb DEFAULT '{}'::jsonb;

-- Add routing metadata to confirmation_tasks for audit trail
ALTER TABLE confirmation_tasks
ADD COLUMN IF NOT EXISTS assigned_role text,
ADD COLUMN IF NOT EXISTS routing_mode text;

-- Update auto_create_confirmation_task trigger to use team routing config
CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_setters UUID[];
  active_closers UUID[];
  assigned_user_id UUID;
  assigned_role_type text;
  min_count INTEGER;
  calculated_due_at TIMESTAMPTZ;
  team_confirmation_schedule JSONB;
  required_conf_count INTEGER;
  team_routing_mode text;
  team_setter_conf_count integer;
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

  -- Get team's routing configuration
  SELECT 
    confirmation_schedule,
    confirmation_routing_mode,
    confirmation_setter_count
  INTO 
    team_confirmation_schedule,
    team_routing_mode,
    team_setter_conf_count
  FROM teams
  WHERE id = NEW.team_id;

  -- Set defaults if null
  team_routing_mode := COALESCE(team_routing_mode, 'setter_only');
  team_setter_conf_count := COALESCE(team_setter_conf_count, 2);
  required_conf_count := COALESCE(jsonb_array_length(team_confirmation_schedule), 1);

  -- Calculate due_at using first confirmation schedule
  IF team_confirmation_schedule IS NOT NULL AND jsonb_array_length(team_confirmation_schedule) > 0 THEN
    calculated_due_at := NEW.start_at_utc - 
      ((team_confirmation_schedule->0->>'hours_before')::numeric * INTERVAL '1 hour');
  ELSE
    calculated_due_at := NEW.start_at_utc - INTERVAL '24 hours';
  END IF;

  -- Determine who should be assigned based on routing mode
  IF team_routing_mode = 'setter_only' THEN
    -- Assign to setter (existing behavior)
    IF NEW.setter_id IS NOT NULL THEN
      assigned_user_id := NEW.setter_id;
      assigned_role_type := 'setter';
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
        
        assigned_role_type := 'setter';
      END IF;
    END IF;

  ELSIF team_routing_mode = 'closer_only' THEN
    -- Assign to closer
    IF NEW.closer_id IS NOT NULL THEN
      assigned_user_id := NEW.closer_id;
      assigned_role_type := 'closer';
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
        
        assigned_role_type := 'closer';
      END IF;
    END IF;

  ELSIF team_routing_mode = 'sequential_setter_then_closer' THEN
    -- First confirmation(s) go to setter, later ones to closer
    -- For the first task (sequence 1), assign based on setter count
    IF 1 <= team_setter_conf_count THEN
      -- This confirmation should go to setter
      IF NEW.setter_id IS NOT NULL THEN
        assigned_user_id := NEW.setter_id;
        assigned_role_type := 'setter';
      ELSE
        -- Get active setters
        SELECT ARRAY_AGG(tm.user_id) INTO active_setters
        FROM team_members tm
        LEFT JOIN setter_rotation_settings srs ON srs.setter_id = tm.user_id AND srs.team_id = tm.team_id
        WHERE tm.team_id = NEW.team_id
          AND tm.role = 'setter'
          AND tm.is_active = true
          AND (srs.is_in_rotation IS NULL OR srs.is_in_rotation = true);

        IF active_setters IS NOT NULL AND array_length(active_setters, 1) > 0 THEN
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
          
          assigned_role_type := 'setter';
        END IF;
      END IF;
    ELSE
      -- This confirmation should go to closer
      IF NEW.closer_id IS NOT NULL THEN
        assigned_user_id := NEW.closer_id;
        assigned_role_type := 'closer';
      ELSE
        SELECT ARRAY_AGG(tm.user_id) INTO active_closers
        FROM team_members tm
        WHERE tm.team_id = NEW.team_id
          AND tm.role = 'closer'
          AND tm.is_active = true;

        IF active_closers IS NOT NULL AND array_length(active_closers, 1) > 0 THEN
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
          
          assigned_role_type := 'closer';
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update appointment setter/closer if assigned
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
    team_routing_mode
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- Update create_task_with_assignment to support role-based assignment
CREATE OR REPLACE FUNCTION public.create_task_with_assignment(
  p_team_id uuid,
  p_appointment_id uuid,
  p_task_type task_type,
  p_follow_up_date date DEFAULT NULL,
  p_follow_up_reason text DEFAULT NULL,
  p_reschedule_date date DEFAULT NULL,
  p_preferred_role text DEFAULT 'auto'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_members UUID[];
  assigned_member UUID;
  min_count INTEGER;
  new_task_id UUID;
  existing_setter UUID;
  existing_closer UUID;
  appointment_start TIMESTAMPTZ;
  calculated_due_at TIMESTAMPTZ;
  target_role text;
  team_routing_mode text;
BEGIN
  -- Get appointment details and team routing config
  SELECT 
    a.setter_id, 
    a.closer_id, 
    a.start_at_utc,
    t.confirmation_routing_mode
  INTO 
    existing_setter, 
    existing_closer, 
    appointment_start,
    team_routing_mode
  FROM appointments a
  JOIN teams t ON t.id = a.team_id
  WHERE a.id = p_appointment_id;

  -- Determine target role based on preference and routing config
  IF p_preferred_role = 'auto' THEN
    IF p_task_type = 'call_confirmation' THEN
      target_role := CASE 
        WHEN team_routing_mode = 'closer_only' THEN 'closer'
        ELSE 'setter'
      END;
    ELSE
      target_role := 'setter'; -- Default for follow-up/reschedule tasks
    END IF;
  ELSE
    target_role := p_preferred_role;
  END IF;

  -- Calculate due_at for call_confirmation tasks
  IF p_task_type = 'call_confirmation' THEN
    calculated_due_at := appointment_start - INTERVAL '24 hours';
  END IF;

  -- Try to assign to existing team member on appointment first
  IF target_role = 'setter' AND existing_setter IS NOT NULL THEN
    assigned_member := existing_setter;
  ELSIF target_role = 'closer' AND existing_closer IS NOT NULL THEN
    assigned_member := existing_closer;
  ELSE
    -- Get active members of target role
    SELECT ARRAY_AGG(user_id) INTO active_members
    FROM team_members
    WHERE team_id = p_team_id
      AND role = target_role
      AND is_active = true;

    -- Round-robin assignment
    IF active_members IS NOT NULL AND array_length(active_members, 1) > 0 THEN
      SELECT assigned_to, COUNT(*) INTO assigned_member, min_count
      FROM confirmation_tasks
      WHERE team_id = p_team_id
        AND status = 'pending'
        AND assigned_to = ANY(active_members)
      GROUP BY assigned_to
      ORDER BY COUNT(*) ASC
      LIMIT 1;

      IF assigned_member IS NULL THEN
        assigned_member := active_members[1];
      END IF;
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
    team_routing_mode
  ) RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$function$;