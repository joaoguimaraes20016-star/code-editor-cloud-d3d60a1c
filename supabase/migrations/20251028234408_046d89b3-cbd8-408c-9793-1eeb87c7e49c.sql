
-- Fix the function search path security warning
CREATE OR REPLACE FUNCTION create_confirmation_task_for_appointment()
RETURNS TRIGGER AS $$
DECLARE
  active_setter_id uuid;
  setter_task_count integer;
  min_task_count integer := 999999;
BEGIN
  -- Find the active setter with the fewest pending tasks (round-robin)
  FOR active_setter_id IN
    SELECT tm.user_id
    FROM team_members tm
    WHERE tm.team_id = NEW.team_id
      AND tm.role = 'setter'
      AND tm.is_active = true
  LOOP
    -- Count pending tasks for this setter
    SELECT COUNT(*)
    INTO setter_task_count
    FROM confirmation_tasks
    WHERE team_id = NEW.team_id
      AND assigned_to = active_setter_id
      AND status = 'pending';
    
    -- Track setter with minimum tasks
    IF setter_task_count < min_task_count THEN
      min_task_count := setter_task_count;
    END IF;
  END LOOP;

  -- Get the setter with fewest tasks
  SELECT tm.user_id INTO active_setter_id
  FROM team_members tm
  WHERE tm.team_id = NEW.team_id
    AND tm.role = 'setter'
    AND tm.is_active = true
    AND (
      SELECT COUNT(*)
      FROM confirmation_tasks ct
      WHERE ct.team_id = NEW.team_id
        AND ct.assigned_to = tm.user_id
        AND ct.status = 'pending'
    ) = min_task_count
  LIMIT 1;

  -- Insert the confirmation task
  INSERT INTO confirmation_tasks (
    team_id,
    appointment_id,
    status,
    assigned_to,
    assigned_at,
    auto_return_at
  )
  VALUES (
    NEW.team_id,
    NEW.id,
    'pending',
    active_setter_id,
    CASE WHEN active_setter_id IS NOT NULL THEN now() ELSE NULL END,
    CASE WHEN active_setter_id IS NOT NULL THEN now() + interval '2 hours' ELSE NULL END
  );

  -- Log activity
  INSERT INTO activity_logs (
    team_id,
    appointment_id,
    actor_id,
    actor_name,
    action_type,
    note
  )
  VALUES (
    NEW.team_id,
    NEW.id,
    NULL,
    'System',
    'Created',
    CASE 
      WHEN active_setter_id IS NOT NULL THEN 'Task auto-assigned via round-robin'
      ELSE 'Task created in queue'
    END
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
