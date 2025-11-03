-- Add assignment_source column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN assignment_source TEXT;

-- Create index for better query performance
CREATE INDEX idx_appointments_assignment_source ON public.appointments(assignment_source);

-- Update existing appointments based on current data
-- Appointments with setter_id but no confirmation task = booking link
UPDATE public.appointments 
SET assignment_source = 'booking_link'
WHERE setter_id IS NOT NULL 
  AND NOT EXISTS (
    SELECT 1 FROM confirmation_tasks 
    WHERE confirmation_tasks.appointment_id = appointments.id
  );

-- Appointments with claimed_manually = true = manual claim
UPDATE public.appointments a
SET assignment_source = 'manual_claim'
FROM confirmation_tasks ct
WHERE ct.appointment_id = a.id 
  AND ct.claimed_manually = true
  AND a.setter_id IS NOT NULL;