-- Drop the automatic follow-up trigger
DROP TRIGGER IF EXISTS auto_create_follow_up_tasks_trigger ON appointments;
DROP FUNCTION IF EXISTS public.auto_create_follow_up_tasks();

-- Create team follow-up settings table
CREATE TABLE IF NOT EXISTS public.team_follow_up_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  pipeline_stage TEXT NOT NULL,
  default_days INTEGER NOT NULL DEFAULT 1,
  default_time TIME NOT NULL DEFAULT '10:00:00',
  suggest_follow_up BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(team_id, pipeline_stage)
);

-- Enable RLS
ALTER TABLE public.team_follow_up_settings ENABLE ROW LEVEL SECURITY;

-- Team members can view settings
CREATE POLICY "Team members can view follow-up settings"
  ON public.team_follow_up_settings
  FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

-- Admins and offer owners can manage settings
CREATE POLICY "Admins can manage follow-up settings"
  ON public.team_follow_up_settings
  FOR ALL
  USING (
    is_team_member(auth.uid(), team_id) AND 
    (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
  );

-- Add trigger for updated_at
CREATE TRIGGER update_team_follow_up_settings_updated_at
  BEFORE UPDATE ON public.team_follow_up_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings for common stages
INSERT INTO public.team_follow_up_settings (team_id, pipeline_stage, default_days, default_time, suggest_follow_up)
SELECT 
  id as team_id,
  'no_show' as pipeline_stage,
  1 as default_days,
  '10:00:00'::time as default_time,
  true as suggest_follow_up
FROM teams
ON CONFLICT (team_id, pipeline_stage) DO NOTHING;

INSERT INTO public.team_follow_up_settings (team_id, pipeline_stage, default_days, default_time, suggest_follow_up)
SELECT 
  id as team_id,
  'canceled' as pipeline_stage,
  2 as default_days,
  '10:00:00'::time as default_time,
  true as suggest_follow_up
FROM teams
ON CONFLICT (team_id, pipeline_stage) DO NOTHING;

INSERT INTO public.team_follow_up_settings (team_id, pipeline_stage, default_days, default_time, suggest_follow_up)
SELECT 
  id as team_id,
  'disqualified' as pipeline_stage,
  7 as default_days,
  '10:00:00'::time as default_time,
  true as suggest_follow_up
FROM teams
ON CONFLICT (team_id, pipeline_stage) DO NOTHING;