-- Fix security issue: Add search_path to check_overdue_tasks function
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_record RECORD;
  team_threshold integer;
BEGIN
  FOR task_record IN 
    SELECT ct.*, t.overdue_threshold_minutes
    FROM confirmation_tasks ct
    JOIN teams t ON t.id = ct.team_id
    WHERE ct.status = 'pending'
      AND ct.is_overdue = false
      AND ct.due_at IS NOT NULL
  LOOP
    team_threshold := COALESCE(task_record.overdue_threshold_minutes, 30);
    
    -- Check if task is now overdue
    IF task_record.due_at < (NOW() - (team_threshold || ' minutes')::interval) THEN
      -- Mark as overdue (stays with assigned setter)
      UPDATE confirmation_tasks
      SET is_overdue = true
      WHERE id = task_record.id;
      
      -- Log activity to notify admin
      INSERT INTO activity_logs (
        team_id,
        appointment_id,
        actor_name,
        action_type,
        note
      ) VALUES (
        task_record.team_id,
        task_record.appointment_id,
        'System',
        'Task Overdue',
        'Confirmation task is overdue - admin attention needed'
      );
    END IF;
  END LOOP;
END;
$$;