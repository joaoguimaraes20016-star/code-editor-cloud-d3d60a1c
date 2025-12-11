-- Add column to store the Calendly scheduling URL for funnels
-- This is needed because calendly_event_types stores API URIs, not scheduling URLs
ALTER TABLE public.teams
ADD COLUMN IF NOT EXISTS calendly_funnel_scheduling_url text;

-- Add comment for documentation
COMMENT ON COLUMN public.teams.calendly_funnel_scheduling_url IS 'The Calendly scheduling URL to use when calendly_enabled_for_funnels is true';