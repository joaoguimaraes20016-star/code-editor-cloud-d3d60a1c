-- Add confirmation schedule to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS confirmation_schedule jsonb DEFAULT '[
  {"sequence": 1, "hours_before": 24, "label": "24h Before"},
  {"sequence": 2, "hours_before": 1, "label": "1h Before"},
  {"sequence": 3, "hours_before": 0.17, "label": "10min Before"}
]'::jsonb;

ALTER TABLE teams ADD COLUMN IF NOT EXISTS overdue_threshold_minutes integer DEFAULT 30;

-- Add new columns to confirmation_tasks table
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS confirmation_attempts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS required_confirmations integer DEFAULT 1;
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS completed_confirmations integer DEFAULT 0;
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS confirmation_sequence integer DEFAULT 1;
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS due_at timestamp with time zone;
ALTER TABLE confirmation_tasks ADD COLUMN IF NOT EXISTS is_overdue boolean DEFAULT false;

-- Create function to check for overdue tasks
CREATE OR REPLACE FUNCTION check_overdue_tasks()
RETURNS void AS $$
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
$$ LANGUAGE plpgsql;