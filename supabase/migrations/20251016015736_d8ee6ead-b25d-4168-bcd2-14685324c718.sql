-- Create status enum for appointments
CREATE TYPE appointment_status AS ENUM ('NEW', 'SHOWED', 'NO_SHOW', 'CANCELLED');

-- Create appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  setter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  setter_name TEXT,
  closer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  closer_name TEXT,
  lead_name TEXT NOT NULL,
  lead_email TEXT NOT NULL,
  start_at_utc TIMESTAMP WITH TIME ZONE NOT NULL,
  status appointment_status NOT NULL DEFAULT 'NEW',
  setter_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Create policies for appointments
CREATE POLICY "Team members can view appointments"
  ON public.appointments
  FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Team members can create appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (is_team_member(auth.uid(), team_id));

CREATE POLICY "Setters can update their own appointment notes"
  ON public.appointments
  FOR UPDATE
  USING (
    is_team_member(auth.uid(), team_id) AND 
    (setter_id = auth.uid() OR has_team_role(auth.uid(), team_id, 'admin'))
  );

CREATE POLICY "Closers and admins can update appointment status"
  ON public.appointments
  FOR UPDATE
  USING (
    is_team_member(auth.uid(), team_id) AND
    (has_team_role(auth.uid(), team_id, 'closer') OR has_team_role(auth.uid(), team_id, 'admin'))
  );

-- Add trigger for updated_at
CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update team_members role to support new roles
ALTER TABLE public.team_members 
  DROP CONSTRAINT IF EXISTS team_members_role_check;

ALTER TABLE public.team_members
  ADD CONSTRAINT team_members_role_check 
  CHECK (role IN ('owner', 'admin', 'member', 'setter', 'closer'));