-- Add Calendly integration columns to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS calendly_access_token TEXT,
ADD COLUMN IF NOT EXISTS calendly_organization_uri TEXT,
ADD COLUMN IF NOT EXISTS calendly_webhook_id TEXT;

COMMENT ON COLUMN public.teams.calendly_access_token IS 'Encrypted Calendly Personal Access Token for webhook integration';
COMMENT ON COLUMN public.teams.calendly_organization_uri IS 'Calendly organization URI for API calls';
COMMENT ON COLUMN public.teams.calendly_webhook_id IS 'ID of registered Calendly webhook for management and cleanup';