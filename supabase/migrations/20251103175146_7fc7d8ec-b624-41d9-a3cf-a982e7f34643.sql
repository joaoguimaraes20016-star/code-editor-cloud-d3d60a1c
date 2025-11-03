-- Fix confirmation task due_at calculation

-- 1. Update auto_create_confirmation_task to set due_at
CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  active_setters UUID[];
  assigned_setter UUID;
  min_count INTEGER;
  calculated_due_at TIMESTAMPTZ;
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

  -- Calculate due_at as 24 hours before appointment
  calculated_due_at := NEW.start_at_utc - INTERVAL '24 hours';

  -- If appointment already has a setter assigned, assign task directly to them
  IF NEW.setter_id IS NOT NULL THEN
    INSERT INTO confirmation_tasks (
      team_id, appointment_id, assigned_to, assigned_at, auto_return_at, status, task_type, due_at
    ) VALUES (
      NEW.team_id, NEW.id, NEW.setter_id, now(), now() + interval '2 hours', 'pending', 'call_confirmation', calculated_due_at
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
    INSERT INTO confirmation_tasks (team_id, appointment_id, status, task_type, due_at)
    VALUES (NEW.team_id, NEW.id, 'pending', 'call_confirmation', calculated_due_at)
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
    team_id, appointment_id, assigned_to, assigned_at, auto_return_at, status, task_type, due_at
  ) VALUES (
    NEW.team_id, NEW.id, assigned_setter, now(), now() + interval '2 hours', 'pending', 'call_confirmation', calculated_due_at
  )
  ON CONFLICT (appointment_id, task_type) DO NOTHING;

  RETURN NEW;
END;
$function$;

-- 2. Update create_task_with_assignment to calculate due_at
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
  active_setters UUID[];
  assigned_setter UUID;
  min_count INTEGER;
  new_task_id UUID;
  existing_setter UUID;
  appointment_start TIMESTAMPTZ;
  calculated_due_at TIMESTAMPTZ;
BEGIN
  -- Get appointment details
  SELECT setter_id, start_at_utc INTO existing_setter, appointment_start
  FROM appointments
  WHERE id = p_appointment_id;

  -- Calculate due_at for call_confirmation tasks
  IF p_task_type = 'call_confirmation' THEN
    calculated_due_at := appointment_start - INTERVAL '24 hours';
  END IF;

  -- If appointment has an existing setter, assign task directly to them
  IF existing_setter IS NOT NULL THEN
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
      due_at
    ) VALUES (
      p_team_id,
      p_appointment_id,
      existing_setter,
      now(),
      now() + interval '2 hours',
      'pending',
      p_task_type,
      p_follow_up_date,
      p_follow_up_reason,
      p_reschedule_date,
      calculated_due_at
    ) RETURNING id INTO new_task_id;
    
    RETURN new_task_id;
  END IF;

  -- Get active setters for this team
  SELECT ARRAY_AGG(user_id) INTO active_setters
  FROM team_members
  WHERE team_id = p_team_id
    AND role = 'setter'
    AND is_active = true;

  -- If no active setters, create unassigned task
  IF active_setters IS NULL OR array_length(active_setters, 1) = 0 THEN
    INSERT INTO confirmation_tasks (
      team_id,
      appointment_id,
      status,
      task_type,
      follow_up_date,
      follow_up_reason,
      reschedule_date,
      due_at
    ) VALUES (
      p_team_id,
      p_appointment_id,
      'pending',
      p_task_type,
      p_follow_up_date,
      p_follow_up_reason,
      p_reschedule_date,
      calculated_due_at
    ) RETURNING id INTO new_task_id;
    
    RETURN new_task_id;
  END IF;

  -- Find setter with fewest pending tasks
  SELECT assigned_to, COUNT(*) INTO assigned_setter, min_count
  FROM confirmation_tasks
  WHERE team_id = p_team_id
    AND status = 'pending'
    AND assigned_to = ANY(active_setters)
  GROUP BY assigned_to
  ORDER BY COUNT(*) ASC
  LIMIT 1;

  -- Assign to setter with fewest tasks, or first active setter if none have tasks
  IF assigned_setter IS NULL THEN
    assigned_setter := active_setters[1];
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
    due_at
  ) VALUES (
    p_team_id,
    p_appointment_id,
    assigned_setter,
    now(),
    now() + interval '2 hours',
    'pending',
    p_task_type,
    p_follow_up_date,
    p_follow_up_reason,
    p_reschedule_date,
    calculated_due_at
  ) RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$function$;

-- 3. Backfill existing tasks with null due_at
UPDATE confirmation_tasks ct
SET due_at = a.start_at_utc - INTERVAL '24 hours'
FROM appointments a
WHERE ct.appointment_id = a.id
  AND ct.task_type = 'call_confirmation'
  AND ct.due_at IS NULL;