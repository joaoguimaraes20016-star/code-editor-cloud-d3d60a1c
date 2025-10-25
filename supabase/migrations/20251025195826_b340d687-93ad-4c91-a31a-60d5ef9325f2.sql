-- Enhance confirmation_tasks to support multiple task types and follow-ups

-- Add task_type enum
CREATE TYPE public.task_type AS ENUM ('call_confirmation', 'follow_up', 'reschedule');

-- Add new columns to confirmation_tasks
ALTER TABLE public.confirmation_tasks
ADD COLUMN task_type public.task_type NOT NULL DEFAULT 'call_confirmation',
ADD COLUMN follow_up_date date,
ADD COLUMN follow_up_reason text,
ADD COLUMN reschedule_date date;

-- Create index for faster querying by task type
CREATE INDEX idx_confirmation_tasks_task_type ON public.confirmation_tasks(task_type);
CREATE INDEX idx_confirmation_tasks_follow_up_date ON public.confirmation_tasks(follow_up_date);

-- Update the auto_create_confirmation_task trigger to only create call_confirmation tasks
DROP TRIGGER IF EXISTS auto_create_confirmation_task_trigger ON public.appointments;

CREATE OR REPLACE FUNCTION public.auto_create_confirmation_task()
RETURNS TRIGGER AS $$
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

  -- Get active setters for this team
  SELECT ARRAY_AGG(user_id) INTO active_setters
  FROM team_members
  WHERE team_id = NEW.team_id
    AND role = 'setter'
    AND is_active = true;

  -- If no active setters, create unassigned task
  IF active_setters IS NULL OR array_length(active_setters, 1) = 0 THEN
    INSERT INTO confirmation_tasks (team_id, appointment_id, status, task_type)
    VALUES (NEW.team_id, NEW.id, 'pending', 'call_confirmation');
    
    INSERT INTO activity_logs (team_id, appointment_id, actor_name, action_type, note)
    VALUES (NEW.team_id, NEW.id, 'System', 'Created', 'Call confirmation task created in queue');
    
    RETURN NEW;
  END IF;

  -- Count tasks per active setter
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
  VALUES (NEW.team_id, NEW.id, 'System', 'Created', 'Call confirmation task auto-assigned via round-robin');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER auto_create_confirmation_task_trigger
AFTER INSERT ON public.appointments
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_confirmation_task();

-- Function to create follow-up or reschedule tasks with auto-assignment
CREATE OR REPLACE FUNCTION public.create_task_with_assignment(
  p_team_id UUID,
  p_appointment_id UUID,
  p_task_type public.task_type,
  p_follow_up_date DATE DEFAULT NULL,
  p_follow_up_reason TEXT DEFAULT NULL,
  p_reschedule_date DATE DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  active_setters UUID[];
  task_counts RECORD;
  assigned_setter UUID;
  new_task_id UUID;
BEGIN
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
      reschedule_date
    ) VALUES (
      p_team_id,
      p_appointment_id,
      'pending',
      p_task_type,
      p_follow_up_date,
      p_follow_up_reason,
      p_reschedule_date
    ) RETURNING id INTO new_task_id;
    
    RETURN new_task_id;
  END IF;

  -- Count tasks per active setter
  SELECT user_id, COUNT(*) as count INTO task_counts
  FROM confirmation_tasks
  WHERE team_id = p_team_id
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
    task_type,
    follow_up_date,
    follow_up_reason,
    reschedule_date
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
    p_reschedule_date
  ) RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;