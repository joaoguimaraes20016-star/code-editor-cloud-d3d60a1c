-- Add pipeline_stage column to confirmation_tasks to track which stage the follow-up is for
ALTER TABLE confirmation_tasks 
ADD COLUMN IF NOT EXISTS pipeline_stage TEXT;

-- Create function to auto-create next follow-up when previous is completed
CREATE OR REPLACE FUNCTION auto_create_next_follow_up()
RETURNS TRIGGER AS $$
DECLARE
  v_appointment RECORD;
  v_next_config RECORD;
  v_original_stage TEXT;
BEGIN
  -- Only proceed if task was just completed and is a follow-up
  IF NEW.status = 'completed' 
     AND OLD.status != 'completed' 
     AND NEW.task_type = 'follow_up' 
  THEN
    
    -- Get appointment's current stage
    SELECT pipeline_stage INTO v_appointment
    FROM appointments
    WHERE id = NEW.appointment_id;
    
    -- Get the original stage this follow-up was for
    v_original_stage := NEW.pipeline_stage;
    
    -- Only continue if stage hasn't changed
    IF v_appointment.pipeline_stage = v_original_stage THEN
      
      -- Look up next follow-up config
      SELECT * INTO v_next_config
      FROM team_follow_up_flow_config
      WHERE team_id = NEW.team_id
        AND pipeline_stage = v_original_stage
        AND sequence = (NEW.follow_up_sequence + 1)
        AND enabled = true
      LIMIT 1;
      
      -- If next config exists, create the task
      IF FOUND THEN
        INSERT INTO confirmation_tasks (
          team_id,
          appointment_id,
          task_type,
          pipeline_stage,
          follow_up_sequence,
          due_at,
          status,
          assigned_role,
          routing_mode
        ) VALUES (
          NEW.team_id,
          NEW.appointment_id,
          'follow_up',
          v_original_stage,
          NEW.follow_up_sequence + 1,
          NOW() + (v_next_config.hours_after * INTERVAL '1 hour'),
          'pending',
          v_next_config.assigned_role,
          'auto_chained'
        );
      END IF;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_create_next_follow_up ON confirmation_tasks;
CREATE TRIGGER trigger_auto_create_next_follow_up
  AFTER UPDATE ON confirmation_tasks
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_next_follow_up();