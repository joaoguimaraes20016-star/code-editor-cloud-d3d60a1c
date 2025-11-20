-- Create email_aliases table for mapping alternative emails to users
CREATE TABLE public.email_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_email text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'calendly',
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  notes text,
  CONSTRAINT valid_email CHECK (alias_email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- Enable RLS
ALTER TABLE public.email_aliases ENABLE ROW LEVEL SECURITY;

-- Team admins can manage email aliases
CREATE POLICY "Team admins can manage email aliases"
  ON public.email_aliases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.user_id = auth.uid()
        AND tm.role IN ('admin', 'owner', 'offer_owner')
    )
  );

-- Users can view aliases in their teams
CREATE POLICY "Users can view aliases in their teams"
  ON public.email_aliases
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.team_members tm1
      JOIN public.team_members tm2 ON tm1.team_id = tm2.team_id
      WHERE tm1.user_id = auth.uid()
        AND tm2.user_id = email_aliases.user_id
    )
  );

-- Insert initial alias for Jaxon Shorter
INSERT INTO public.email_aliases (user_id, alias_email, source, notes, created_by)
SELECT 
  u.id,
  'qquaq.yt@gmail.com',
  'calendly',
  'Jaxon Shorter Calendly account email',
  u.id
FROM auth.users u
WHERE u.email = 'jaxshorter@gmail.com';