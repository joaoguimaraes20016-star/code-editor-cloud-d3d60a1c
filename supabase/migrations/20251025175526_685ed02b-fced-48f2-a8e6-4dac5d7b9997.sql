-- Add retarget functionality fields to appointments table
ALTER TABLE public.appointments
ADD COLUMN IF NOT EXISTS retarget_date date,
ADD COLUMN IF NOT EXISTS retarget_reason text;

COMMENT ON COLUMN public.appointments.retarget_date IS 'Date when this lead should be retargeted for follow-up';
COMMENT ON COLUMN public.appointments.retarget_reason IS 'Reason for retargeting this lead';