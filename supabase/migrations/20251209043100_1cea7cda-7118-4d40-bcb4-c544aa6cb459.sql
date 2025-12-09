-- Add columns to funnel_leads table for enhanced tracking
ALTER TABLE public.funnel_leads 
ADD COLUMN IF NOT EXISTS calendly_booking_data jsonb DEFAULT NULL,
ADD COLUMN IF NOT EXISTS opt_in_status boolean DEFAULT NULL,
ADD COLUMN IF NOT EXISTS opt_in_timestamp timestamptz DEFAULT NULL,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'new',
ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Add webhook configuration columns to funnels table
ALTER TABLE public.funnels
ADD COLUMN IF NOT EXISTS webhook_urls jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS auto_create_contact boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS zapier_webhook_url text DEFAULT NULL;

-- Create contacts table
CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  funnel_lead_id uuid REFERENCES public.funnel_leads(id) ON DELETE SET NULL,
  name text,
  email text,
  phone text,
  opt_in boolean DEFAULT false,
  source text,
  calendly_booked_at timestamptz,
  custom_fields jsonb DEFAULT '{}',
  tags text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create index on email for fast lookups
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_team_id ON public.contacts(team_id);

-- Enable RLS on contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- RLS policies for contacts
CREATE POLICY "Team members can view their contacts"
ON public.contacts
FOR SELECT
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can create contacts"
ON public.contacts
FOR INSERT
WITH CHECK (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can update contacts"
ON public.contacts
FOR UPDATE
USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can delete contacts"
ON public.contacts
FOR DELETE
USING (is_team_member(auth.uid(), team_id));

-- Allow service role to insert contacts (for edge function)
CREATE POLICY "Service role can manage contacts"
ON public.contacts
FOR ALL
USING (true);

-- Add update trigger for contacts
CREATE TRIGGER update_contacts_updated_at
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();