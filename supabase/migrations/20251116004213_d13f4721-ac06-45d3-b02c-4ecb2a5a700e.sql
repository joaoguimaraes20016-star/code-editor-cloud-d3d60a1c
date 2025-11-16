-- Drop the old trigger that calls outdated database function
DROP TRIGGER IF EXISTS trigger_auto_create_confirmation_task ON appointments;

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS auto_create_confirmation_task();

-- Create database webhook to call the auto-create-tasks edge function
-- This webhook will be triggered on INSERT to appointments table
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
  webhook_url := current_setting('app.settings.api_url', true) || '/functions/v1/auto-create-tasks';
  
  -- If we can't get the URL, fall back to environment
  IF webhook_url IS NULL OR webhook_url = '' THEN
    webhook_url := 'https://inbvluddkutyfhsxfqco.supabase.co/functions/v1/auto-create-tasks';
  END IF;

  -- Call the edge function via pg_net
  SELECT INTO request_id net.http_post(
    url := webhook_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
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