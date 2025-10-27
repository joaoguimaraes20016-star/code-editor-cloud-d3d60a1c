-- Update all existing confirmed appointments to NEW status since they were never actually confirmed by setters
UPDATE public.appointments
SET status = 'NEW'
WHERE status = 'CONFIRMED' 
AND id NOT IN (
  SELECT DISTINCT appointment_id 
  FROM confirmation_tasks 
  WHERE status = 'completed'
);

-- Create confirmation tasks for all NEW appointments that don't have tasks yet
INSERT INTO confirmation_tasks (team_id, appointment_id, status, task_type, created_at)
SELECT 
  a.team_id,
  a.id,
  'pending',
  'call_confirmation',
  NOW()
FROM appointments a
WHERE a.status = 'NEW'
AND NOT EXISTS (
  SELECT 1 FROM confirmation_tasks ct 
  WHERE ct.appointment_id = a.id
);