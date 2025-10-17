-- Add column to store selected Calendly event types
ALTER TABLE public.teams 
ADD COLUMN calendly_event_types text[] DEFAULT '{}';

COMMENT ON COLUMN public.teams.calendly_event_types IS 'Array of Calendly event type URIs that should create appointments';