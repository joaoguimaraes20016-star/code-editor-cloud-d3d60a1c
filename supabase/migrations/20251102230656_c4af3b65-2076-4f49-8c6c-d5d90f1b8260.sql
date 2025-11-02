-- Make task creation idempotent in auto_create_confirmation_task trigger
-- This prevents duplicate task errors during imports and reschedules

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
    -- Task already exists, don't create duplicate
    RETURN NEW;
  END IF;

  -- If appointment already has a setter assigned, assign task directly to them
  IF NEW.setter_id IS NOT NULL THEN
    INSERT INTO confirmation_tasks (
      team_id, appointment_id, assigned_to, assigned_at, auto_return_at, status, task_type
    ) VALUES (
      NEW.team_id, NEW.id, NEW.setter_id, now(), now() + interval '2 hours', 'pending', 'call_confirmation'
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
    INSERT INTO confirmation_tasks (team_id, appointment_id, status, task_type)
    VALUES (NEW.team_id, NEW.id, 'pending', 'call_confirmation')
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

  -- Create the task with assignment (idempotent)
  INSERT INTO confirmation_tasks (
    team_id, appointment_id, assigned_to, assigned_at, auto_return_at, status, task_type
  ) VALUES (
    NEW.team_id, NEW.id, assigned_setter, now(), now() + interval '2 hours', 'pending', 'call_confirmation'
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RETURN NEW;
END;
$function$;