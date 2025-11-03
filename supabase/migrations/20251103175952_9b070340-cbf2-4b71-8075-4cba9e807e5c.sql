-- Update existing confirmation tasks to have required_confirmations = 3
-- based on the team's confirmation_schedule
UPDATE confirmation_tasks ct
SET required_confirmations = (
  SELECT jsonb_array_length(t.confirmation_schedule)
  FROM teams t
  WHERE t.id = ct.team_id
)
WHERE ct.task_type = 'call_confirmation'
AND ct.required_confirmations = 1;

-- Update the auto_create_confirmation_task function to read confirmation_schedule
-- and set required_confirmations automatically
CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_setters UUID[];
  assigned_setter UUID;
  min_count INTEGER;
  calculated_due_at TIMESTAMPTZ;
  team_confirmation_schedule JSONB;
  required_conf_count INTEGER;
BEGIN
  -- Only create call confirmation tasks for NEW appointments
  IF NEW.status != 'NEW' THEN
    RETURN NEW;
  END IF;

  -- Check if a confirmation task already exists for this appointment
  IF EXISTS (
    SELECT 1 FROM confirmation_tasks 
    WHERE appointment_id = NEW.id 
    AND task_type = 'call_confirmation'
  ) THEN
    RETURN NEW;
  END IF;

  -- Get team's confirmation schedule
  SELECT confirmation_schedule INTO team_confirmation_schedule
  FROM teams
  WHERE id = NEW.team_id;

  -- Set required_confirmations based on confirmation_schedule length
  required_conf_count := COALESCE(jsonb_array_length(team_confirmation_schedule), 1);

  -- Calculate due_at based on the FIRST confirmation step in the schedule
  -- Default to 24 hours if no schedule exists
  IF team_confirmation_schedule IS NOT NULL AND jsonb_array_length(team_confirmation_schedule) > 0 THEN
    calculated_due_at := NEW.start_at_utc - 
      CAST((team_confirmation_schedule->0->>'hours_before')::numeric || ' hours' AS INTERVAL);
  ELSE
    calculated_due_at := NEW.start_at_utc - INTERVAL '24 hours';
  END IF;

  -- If appointment already has a setter assigned, assign task directly to them
  IF NEW.setter_id IS NOT NULL THEN
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
      confirmation_sequence
    ) VALUES (
      NEW.team_id, 
      NEW.id, 
      NEW.setter_id, 
      now(), 
      now() + interval '2 hours', 
      'pending', 
      'call_confirmation', 
      calculated_due_at,
      required_conf_count,
      1
    )
    ON CONFLICT (appointment_id, task_type) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Get active setters who are in rotation for this team
  SELECT ARRAY_AGG(tm.user_id) INTO active_setters
  FROM team_members tm
  LEFT JOIN setter_rotation_settings srs ON srs.setter_id = tm.user_id AND srs.team_id = tm.team_id
  WHERE tm.team_id = NEW.team_id
    AND tm.role = 'setter'
    AND tm.is_active = true
    AND (srs.is_in_rotation IS NULL OR srs.is_in_rotation = true);

  -- If no active setters in rotation, create unassigned task
  IF active_setters IS NULL OR array_length(active_setters, 1) = 0 THEN
    INSERT INTO confirmation_tasks (
      team_id, 
      appointment_id, 
      status, 
      task_type, 
      due_at,
      required_confirmations,
      confirmation_sequence
    )
    VALUES (
      NEW.team_id, 
      NEW.id, 
      'pending', 
      'call_confirmation', 
      calculated_due_at,
      required_conf_count,
      1
    )
    ON CONFLICT (appointment_id, task_type) DO NOTHING;
    RETURN NEW;
  END IF;

  -- Find setter with fewest pending tasks (round-robin)
  SELECT assigned_to, COUNT(*) INTO assigned_setter, min_count
  FROM confirmation_tasks
  WHERE team_id = NEW.team_id
    AND status = 'pending'
    AND assigned_to = ANY(active_setters)
  GROUP BY assigned_to
  ORDER BY COUNT(*) ASC
  LIMIT 1;

  -- Assign to setter with fewest tasks, or first active setter if none have tasks
  IF assigned_setter IS NULL THEN
    assigned_setter := active_setters[1];
  END IF;

  -- Create the task with assignment
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
    confirmation_sequence
  ) VALUES (
    NEW.team_id, 
    NEW.id, 
    assigned_setter, 
    now(), 
    now() + interval '2 hours', 
    'pending', 
    'call_confirmation', 
    calculated_due_at,
    required_conf_count,
    1
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RETURN NEW;
END;
$function$;