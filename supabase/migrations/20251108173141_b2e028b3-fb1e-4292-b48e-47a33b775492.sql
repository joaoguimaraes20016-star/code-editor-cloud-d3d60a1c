-- Fix auto_create_confirmation_task trigger to prevent NULL due_at
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
  fallback_hours NUMERIC := 1; -- Default 1 hour before appointment
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

  -- If no config exists, use fallback logic
  IF team_flow_config IS NULL OR team_flow_config = '[]'::jsonb THEN
    RAISE WARNING '[TRIGGER] No confirmation_flow_config for team %, using fallback', NEW.team_id;
    calculated_due_at := NEW.start_at_utc - (fallback_hours * INTERVAL '1 hour');
    assigned_role_type := 'setter';
    required_conf_count := 1;
  ELSE
    -- Count enabled confirmations
    SELECT COUNT(*) INTO required_conf_count
    FROM jsonb_array_elements(team_flow_config) AS conf
    WHERE (conf->>'enabled')::boolean = true;

    -- If no confirmations enabled, don't create task
    IF required_conf_count = 0 THEN
      RAISE WARNING '[TRIGGER] No enabled confirmations for team %, skipping task creation', NEW.team_id;
      RETURN NEW;
    END IF;

    -- Get first enabled confirmation
    SELECT conf INTO first_enabled_conf
    FROM jsonb_array_elements(team_flow_config) AS conf
    WHERE (conf->>'enabled')::boolean = true
    ORDER BY (conf->>'sequence')::int
    LIMIT 1;

    -- Calculate due_at using first enabled confirmation with fallback
    IF first_enabled_conf->>'hours_before' IS NOT NULL THEN
      calculated_due_at := NEW.start_at_utc - 
        ((first_enabled_conf->>'hours_before')::numeric * INTERVAL '1 hour');
    ELSE
      RAISE WARNING '[TRIGGER] Missing hours_before in config for team %, using fallback', NEW.team_id;
      calculated_due_at := NEW.start_at_utc - (fallback_hours * INTERVAL '1 hour');
    END IF;

    -- Determine assigned role with fallback
    assigned_role_type := COALESCE(first_enabled_conf->>'assigned_role', 'setter');
  END IF;

  -- Don't create task if role is "off"
  IF assigned_role_type = 'off' THEN
    RETURN NEW;
  END IF;

  -- Final safety check: ensure due_at is never NULL
  IF calculated_due_at IS NULL THEN
    RAISE WARNING '[TRIGGER] calculated_due_at is NULL for appointment %, using immediate fallback', NEW.id;
    calculated_due_at := NEW.start_at_utc - (fallback_hours * INTERVAL '1 hour');
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
      END IF;
    END IF;
  ELSIF assigned_role_type = 'admin' THEN
    SELECT ARRAY_AGG(tm.user_id) INTO active_admins
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.role = 'admin'
      AND tm.is_active = true;

    IF active_admins IS NOT NULL AND array_length(active_admins, 1) > 0 THEN
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
    SELECT ARRAY_AGG(tm.user_id) INTO active_offer_owners
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.role = 'offer_owner'
      AND tm.is_active = true;

    IF active_offer_owners IS NOT NULL AND array_length(active_offer_owners, 1) > 0 THEN
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

  -- Log before insert
  RAISE NOTICE '[TRIGGER] Creating task: appointment_id=%, due_at=%, role=%, required=%', 
    NEW.id, calculated_due_at, assigned_role_type, required_conf_count;

  -- Create the task with guaranteed non-NULL due_at
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
    calculated_due_at, -- Now guaranteed to be non-NULL
    COALESCE(required_conf_count, 1),
    1,
    assigned_role_type,
    'flow_config'
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RAISE NOTICE '[TRIGGER] Task created successfully for appointment %', NEW.id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[TRIGGER] Error creating task for appointment %: %', NEW.id, SQLERRM;
  RETURN NEW; -- Don't block appointment creation if task fails
END;
$function$;