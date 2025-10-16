-- Create team invitations table
CREATE TABLE public.team_invitations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

-- Team members can view invitations for their team
CREATE POLICY "Team members can view team invitations"
ON public.team_invitations
FOR SELECT
USING (is_team_member(auth.uid(), team_id));

-- Team owners can create invitations
CREATE POLICY "Team owners can create invitations"
ON public.team_invitations
FOR INSERT
WITH CHECK (is_team_owner(auth.uid(), team_id));

-- Team owners can delete invitations
CREATE POLICY "Team owners can delete invitations"
ON public.team_invitations
FOR DELETE
USING (is_team_owner(auth.uid(), team_id));

-- Create index for faster token lookups
CREATE INDEX idx_team_invitations_token ON public.team_invitations(token);
CREATE INDEX idx_team_invitations_email ON public.team_invitations(email);