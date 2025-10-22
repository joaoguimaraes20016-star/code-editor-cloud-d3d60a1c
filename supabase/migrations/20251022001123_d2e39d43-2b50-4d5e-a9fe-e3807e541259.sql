-- Allow team members (including clients) to create team assets
CREATE POLICY "Team members can create team assets"
ON team_assets
FOR INSERT
WITH CHECK (
  is_team_member(auth.uid(), team_id)
);

-- Allow team members to view team assets
CREATE POLICY "All team members can view team assets"
ON team_assets
FOR SELECT
USING (
  is_team_member(auth.uid(), team_id)
);

-- Allow team members to update their own created assets
CREATE POLICY "Team members can update their own assets"
ON team_assets
FOR UPDATE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (created_by = auth.uid() OR has_team_role(auth.uid(), team_id, 'owner'::text) OR has_team_role(auth.uid(), team_id, 'admin'::text) OR has_team_role(auth.uid(), team_id, 'offer_owner'::text))
);

-- Allow team members to delete their own assets
CREATE POLICY "Team members can delete their own assets"
ON team_assets
FOR DELETE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (created_by = auth.uid() OR has_team_role(auth.uid(), team_id, 'owner'::text) OR has_team_role(auth.uid(), team_id, 'admin'::text) OR has_team_role(auth.uid(), team_id, 'offer_owner'::text))
);