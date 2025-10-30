-- Phase 1 & 3: Add team customization columns (defaults preserve existing behavior)
ALTER TABLE teams 
ADD COLUMN IF NOT EXISTS auto_create_tasks BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS dashboard_preferences JSONB DEFAULT '{
  "showRevenue": true,
  "showClosedDeals": true,
  "showSetterPerformance": true,
  "showMRRTracking": true,
  "showUpcomingAppointments": true
}'::jsonb;

-- Phase 3: Automation rules table (optional feature, doesn't affect existing flows)
CREATE TABLE IF NOT EXISTS team_automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  rule_name TEXT NOT NULL,
  trigger_event TEXT NOT NULL,
  trigger_conditions JSONB DEFAULT '{}'::jsonb,
  action_type TEXT NOT NULL,
  action_config JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE team_automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage automation rules"
ON team_automation_rules FOR ALL
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'admin') OR 
   has_team_role(auth.uid(), team_id, 'offer_owner'))
);

-- Phase 3: Saved reports table (optional feature, doesn't affect existing flows)
CREATE TABLE IF NOT EXISTS saved_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE NOT NULL,
  report_name TEXT NOT NULL,
  report_type TEXT NOT NULL,
  report_config JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  is_shared BOOLEAN DEFAULT false
);

ALTER TABLE saved_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members view shared reports"
ON saved_reports FOR SELECT
USING (
  is_team_member(auth.uid(), team_id) AND 
  (is_shared = true OR created_by = auth.uid())
);

CREATE POLICY "Users manage their own reports"
ON saved_reports FOR ALL
USING (created_by = auth.uid());