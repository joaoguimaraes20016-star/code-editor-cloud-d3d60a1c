
-- Add asset_categories column to teams table for custom section management
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS asset_categories jsonb DEFAULT '[
  {"id": "resources", "label": "Resources", "icon": "BookOpen", "order_index": 0},
  {"id": "offer", "label": "Offer", "icon": "Briefcase", "order_index": 1},
  {"id": "scripts", "label": "Scripts & SOPs", "icon": "FileText", "order_index": 2},
  {"id": "training", "label": "Training", "icon": "Video", "order_index": 3},
  {"id": "tracking", "label": "Tracking Sheets", "icon": "FileSpreadsheet", "order_index": 4},
  {"id": "team_onboarding", "label": "Team Onboarding", "icon": "Users", "order_index": 5},
  {"id": "client_onboarding", "label": "Prospect Onboarding", "icon": "Briefcase", "order_index": 6}
]'::jsonb;
