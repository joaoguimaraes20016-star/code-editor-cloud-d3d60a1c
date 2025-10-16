-- Add revenue field to appointments for when closers close deals
ALTER TABLE public.appointments
ADD COLUMN revenue NUMERIC DEFAULT 0;

-- Update the appointments table to better support the workflow
-- No changes needed to existing columns, just adding revenue