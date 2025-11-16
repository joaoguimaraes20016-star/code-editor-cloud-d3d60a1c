-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_notify_auto_create_tasks ON appointments;
DROP TRIGGER IF EXISTS trigger_auto_create_confirmation_task ON appointments;
DROP FUNCTION IF EXISTS notify_auto_create_tasks();
DROP FUNCTION IF EXISTS auto_create_confirmation_task();

-- Create database webhook to call the auto-create-tasks edge function
CREATE OR REPLACE FUNCTION notify_auto_create_tasks()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  webhook_url TEXT;
  request_id BIGINT;
BEGIN
  -- Construct the webhook URL
  webhook_url := 'https://inbvluddkutyfhsxfqco.supabase.co/functions/v1/auto-create-tasks';

  -- Call the edge function via pg_net
  SELECT INTO request_id net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('request.jwt.claims', true)::json->>'role'
    ),
    body := jsonb_build_object(
      'appointment_id', NEW.id,
      'team_id', NEW.team_id,
      'start_at_utc', NEW.start_at_utc,
      'setter_id', NEW.setter_id,
      'closer_id', NEW.closer_id,
      'status', NEW.status
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't block appointment creation
  RAISE WARNING 'Failed to call auto-create-tasks webhook: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create trigger to call the webhook function
CREATE TRIGGER trigger_notify_auto_create_tasks
  AFTER INSERT ON appointments
  FOR EACH ROW
  WHEN (NEW.status = 'NEW')
  EXECUTE FUNCTION notify_auto_create_tasks();