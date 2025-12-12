-- Create automations table for storing automation definitions
CREATE TABLE public.automations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trigger_type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create automation_runs table for logging automation executions
CREATE TABLE public.automation_runs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  automation_id uuid NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  trigger_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error')),
  error_message text,
  steps_executed jsonb NOT NULL DEFAULT '[]'::jsonb,
  context_snapshot jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_automations_team_trigger ON public.automations(team_id, trigger_type) WHERE is_active = true;
CREATE INDEX idx_automation_runs_automation ON public.automation_runs(automation_id);
CREATE INDEX idx_automation_runs_team ON public.automation_runs(team_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for automations
CREATE POLICY "Team admins can manage automations"
ON public.automations FOR ALL
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

CREATE POLICY "Team members can view automations"
ON public.automations FOR SELECT
USING (is_team_member(auth.uid(), team_id));

-- RLS Policies for automation_runs
CREATE POLICY "Team admins can view automation runs"
ON public.automation_runs FOR SELECT
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

CREATE POLICY "Service role can insert automation runs"
ON public.automation_runs FOR INSERT
WITH CHECK (true);

-- Trigger for updated_at on automations
CREATE TRIGGER update_automations_updated_at
BEFORE UPDATE ON public.automations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();