-- Function to recalculate due_at for pending tasks when schedule changes
CREATE OR REPLACE FUNCTION recalculate_pending_task_due_dates()
RETURNS TRIGGER AS $$
BEGIN
  -- Only proceed if confirmation_schedule actually changed
  IF OLD.confirmation_schedule IS DISTINCT FROM NEW.confirmation_schedule THEN
    -- Update all pending confirmation tasks for this team
    UPDATE confirmation_tasks ct
    SET due_at = (
      SELECT a.start_at_utc - (
        (NEW.confirmation_schedule->0->>'hours_before')::numeric * interval '1 hour'
      )
      FROM appointments a
      WHERE a.id = ct.appointment_id
    ),
    required_confirmations = jsonb_array_length(NEW.confirmation_schedule)
    WHERE ct.team_id = NEW.id
      AND ct.status = 'pending'
      AND ct.task_type = 'call_confirmation';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
CREATE TRIGGER update_task_due_dates_on_schedule_change
  AFTER UPDATE OF confirmation_schedule ON teams
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_pending_task_due_dates();