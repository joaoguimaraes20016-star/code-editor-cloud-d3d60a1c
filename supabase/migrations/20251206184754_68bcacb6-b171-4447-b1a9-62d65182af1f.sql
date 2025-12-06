-- Add meeting_link column to appointments table
ALTER TABLE public.appointments 
ADD COLUMN meeting_link text NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.appointments.meeting_link IS 'Video conferencing link (Zoom, Google Meet, etc.) from Calendly event';