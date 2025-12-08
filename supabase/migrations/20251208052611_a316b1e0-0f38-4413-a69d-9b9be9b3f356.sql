-- Create funnels table
CREATE TABLE public.funnels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  settings JSONB NOT NULL DEFAULT '{
    "logo_url": null,
    "primary_color": "#00bcd4",
    "background_color": "#000000",
    "button_text": "Continue",
    "ghl_webhook_url": null
  }'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create funnel_steps table
CREATE TABLE public.funnel_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  step_type TEXT NOT NULL CHECK (step_type IN ('welcome', 'text_question', 'multi_choice', 'email_capture', 'phone_capture', 'video', 'thank_you')),
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create funnel_leads table
CREATE TABLE public.funnel_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  funnel_id UUID NOT NULL REFERENCES public.funnels(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  email TEXT,
  phone TEXT,
  name TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  ghl_synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_funnels_team_id ON public.funnels(team_id);
CREATE INDEX idx_funnels_slug ON public.funnels(slug);
CREATE INDEX idx_funnel_steps_funnel_id ON public.funnel_steps(funnel_id);
CREATE INDEX idx_funnel_steps_order ON public.funnel_steps(funnel_id, order_index);
CREATE INDEX idx_funnel_leads_funnel_id ON public.funnel_leads(funnel_id);
CREATE INDEX idx_funnel_leads_team_id ON public.funnel_leads(team_id);
CREATE INDEX idx_funnel_leads_email ON public.funnel_leads(email);

-- Enable RLS
ALTER TABLE public.funnels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.funnel_leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for funnels
CREATE POLICY "Team members can view their funnels"
ON public.funnels FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Admins and offer owners can create funnels"
ON public.funnels FOR INSERT
WITH CHECK (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

CREATE POLICY "Admins and offer owners can update funnels"
ON public.funnels FOR UPDATE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

CREATE POLICY "Admins and offer owners can delete funnels"
ON public.funnels FOR DELETE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

CREATE POLICY "Public can view published funnels by slug"
ON public.funnels FOR SELECT
USING (status = 'published');

-- RLS Policies for funnel_steps
CREATE POLICY "Team members can view their funnel steps"
ON public.funnel_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_steps.funnel_id
    AND is_team_member(auth.uid(), f.team_id)
  )
);

CREATE POLICY "Admins and offer owners can manage funnel steps"
ON public.funnel_steps FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_steps.funnel_id
    AND is_team_member(auth.uid(), f.team_id)
    AND (has_team_role(auth.uid(), f.team_id, 'admin') OR has_team_role(auth.uid(), f.team_id, 'offer_owner'))
  )
);

CREATE POLICY "Public can view steps of published funnels"
ON public.funnel_steps FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_steps.funnel_id
    AND f.status = 'published'
  )
);

-- RLS Policies for funnel_leads
CREATE POLICY "Team members can view their funnel leads"
ON public.funnel_leads FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Public can insert leads"
ON public.funnel_leads FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.funnels f
    WHERE f.id = funnel_leads.funnel_id
    AND f.status = 'published'
    AND f.team_id = funnel_leads.team_id
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_funnels_updated_at
BEFORE UPDATE ON public.funnels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_funnel_steps_updated_at
BEFORE UPDATE ON public.funnel_steps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();