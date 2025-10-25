-- Create team_pipeline_stages table for custom pipeline management
CREATE TABLE public.team_pipeline_stages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  stage_id TEXT NOT NULL,
  stage_label TEXT NOT NULL,
  stage_color TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, stage_id)
);

-- Add index for better query performance
CREATE INDEX idx_team_pipeline_stages_team_id ON public.team_pipeline_stages(team_id);
CREATE INDEX idx_team_pipeline_stages_order ON public.team_pipeline_stages(team_id, order_index);

-- Enable RLS
ALTER TABLE public.team_pipeline_stages ENABLE ROW LEVEL SECURITY;

-- Team members can view pipeline stages
CREATE POLICY "Team members can view pipeline stages"
ON public.team_pipeline_stages
FOR SELECT
USING (is_team_member(auth.uid(), team_id));

-- Admins and offer owners can manage pipeline stages
CREATE POLICY "Admins and offer owners can manage pipeline stages"
ON public.team_pipeline_stages
FOR ALL
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR has_team_role(auth.uid(), team_id, 'offer_owner'))
);

-- Create trigger for updated_at
CREATE TRIGGER update_team_pipeline_stages_updated_at
BEFORE UPDATE ON public.team_pipeline_stages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default stages for all existing teams
INSERT INTO public.team_pipeline_stages (team_id, stage_id, stage_label, stage_color, order_index, is_default)
SELECT 
  id as team_id,
  stage_id,
  stage_label,
  stage_color,
  order_index,
  true as is_default
FROM public.teams
CROSS JOIN (
  VALUES
    ('new', 'New Leads', 'blue', 0),
    ('contacted', 'Contacted', 'purple', 1),
    ('in_progress', 'In Progress', 'indigo', 2),
    ('won', 'Closed Won', 'green', 3),
    ('lost', 'Closed Lost', 'red', 4)
) AS default_stages(stage_id, stage_label, stage_color, order_index);