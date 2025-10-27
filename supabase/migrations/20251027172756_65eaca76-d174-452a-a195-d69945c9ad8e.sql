-- Drop and recreate the auto_create_confirmation_task function with proper logic
DROP FUNCTION IF EXISTS public.auto_create_confirmation_task() CASCADE;

CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  active_setters UUID[];
  task_counts RECORD;
  assigned_setter UUID;
  min_count INTEGER;
BEGIN
  -- Only create call confirmation tasks for NEW appointments
  IF NEW.status != 'NEW' THEN
    RETURN NEW;
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
      task_type
    ) VALUES (
      NEW.team_id,
      NEW.id,
      NEW.setter_id,
      now(),
      now() + interval '2 hours',
      'pending',
      'call_confirmation'
    );

    INSERT INTO activity_logs (team_id, appointment_id, actor_name, action_type, note)
    VALUES (NEW.team_id, NEW.id, 'System', 'Created', 'Task assigned to existing setter');
    
    RETURN NEW;
  END IF;

  -- Get active setters that are in rotation
  SELECT ARRAY_AGG(tm.user_id) INTO active_setters
  FROM team_members tm
  WHERE tm.team_id = NEW.team_id
    AND tm.role = 'setter'
    AND tm.is_active = true
    AND (
      -- Include if not in settings table (default to in rotation)
      NOT EXISTS (
        SELECT 1 FROM setter_rotation_settings srs 
        WHERE srs.team_id = NEW.team_id 
        AND srs.setter_id = tm.user_id
      )
      OR
      -- Include if explicitly set to in rotation
      EXISTS (
        SELECT 1 FROM setter_rotation_settings srs 
        WHERE srs.team_id = NEW.team_id 
        AND srs.setter_id = tm.user_id 
        AND srs.is_in_rotation = true
      )
    );

  -- If no active setters in rotation, create unassigned task
  IF active_setters IS NULL OR array_length(active_setters, 1) = 0 THEN
    INSERT INTO confirmation_tasks (team_id, appointment_id, status, task_type)
    VALUES (NEW.team_id, NEW.id, 'pending', 'call_confirmation');
    
    INSERT INTO activity_logs (team_id, appointment_id, actor_name, action_type, note)
    VALUES (NEW.team_id, NEW.id, 'System', 'Created', 'Call confirmation task created in queue');
    
    RETURN NEW;
  END IF;

  -- Count tasks per active setter in rotation
  SELECT user_id, COUNT(*) as count INTO task_counts
  FROM confirmation_tasks
  WHERE team_id = NEW.team_id
    AND status = 'pending'
    AND assigned_to = ANY(active_setters)
  GROUP BY user_id
  ORDER BY count ASC
  LIMIT 1;

  -- Assign to setter with fewest tasks, or first active setter if none have tasks
  IF FOUND THEN
    assigned_setter := task_counts.user_id;
  ELSE
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
    task_type
  ) VALUES (
    NEW.team_id,
    NEW.id,
    assigned_setter,
    now(),
    now() + interval '2 hours',
    'pending',
    'call_confirmation'
  );

  -- Log activity
  INSERT INTO activity_logs (team_id, appointment_id, actor_name, action_type, note)
  VALUES (NEW.team_id, NEW.id, 'System', 'Created', 'Task auto-assigned via round-robin');

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trigger_auto_create_confirmation_task ON public.appointments;

CREATE TRIGGER trigger_auto_create_confirmation_task
  AFTER INSERT ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_confirmation_task();