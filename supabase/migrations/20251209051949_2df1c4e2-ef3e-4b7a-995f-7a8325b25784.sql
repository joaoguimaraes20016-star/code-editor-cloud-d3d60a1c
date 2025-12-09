-- Create domains table for custom domain management
CREATE TABLE public.funnel_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  verification_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  verified_at TIMESTAMPTZ,
  ssl_provisioned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(domain)
);

-- Add domain_id to funnels table
ALTER TABLE public.funnels ADD COLUMN domain_id UUID REFERENCES public.funnel_domains(id) ON DELETE SET NULL;

-- Create team integrations table for GHL, Zapier, etc.
CREATE TABLE public.team_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  config JSONB DEFAULT '{}'::jsonb,
  is_connected BOOLEAN DEFAULT false,
  connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, integration_type)
);

-- Enable RLS
ALTER TABLE public.funnel_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_integrations ENABLE ROW LEVEL SECURITY;

-- RLS policies for funnel_domains
CREATE POLICY "Team members can view their team's domains"
ON public.funnel_domains FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins can manage domains"
ON public.funnel_domains FOR ALL
USING (is_team_admin(auth.uid(), team_id));

-- RLS policies for team_integrations
CREATE POLICY "Team members can view their team's integrations"
ON public.team_integrations FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team admins can manage integrations"
ON public.team_integrations FOR ALL
USING (is_team_admin(auth.uid(), team_id));

-- Triggers for updated_at
CREATE TRIGGER update_funnel_domains_updated_at
BEFORE UPDATE ON public.funnel_domains
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_integrations_updated_at
BEFORE UPDATE ON public.team_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();