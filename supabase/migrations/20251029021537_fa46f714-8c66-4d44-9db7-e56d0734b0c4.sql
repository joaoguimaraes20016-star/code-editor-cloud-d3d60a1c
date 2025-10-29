-- Add Calendly reschedule/cancel URLs to appointments table
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reschedule_url text,
ADD COLUMN IF NOT EXISTS cancel_url text,
ADD COLUMN IF NOT EXISTS calendly_invitee_uri text;

-- Create index for faster lookups on reschedule status
CREATE INDEX IF NOT EXISTS idx_confirmation_tasks_awaiting_reschedule 
ON confirmation_tasks(appointment_id, status) 
WHERE status = 'awaiting_reschedule';

-- Create index for Calendly URI lookups
CREATE INDEX IF NOT EXISTS idx_appointments_calendly_uri 
ON appointments(calendly_invitee_uri) 
WHERE calendly_invitee_uri IS NOT NULL;