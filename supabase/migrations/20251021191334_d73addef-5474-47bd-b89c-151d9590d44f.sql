-- Allow deletion of client assets without team_id if user created them
DROP POLICY IF EXISTS "Offer owners and admins can delete client assets" ON client_assets;

CREATE POLICY "Offer owners and admins can delete client assets" 
ON client_assets 
FOR DELETE 
USING (
  -- Can delete if they're part of the team with the right role
  (team_id IS NOT NULL AND is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR 
    has_team_role(auth.uid(), team_id, 'admin'::text) OR 
    has_team_role(auth.uid(), team_id, 'owner'::text)
  ))
  OR
  -- Can delete if they created it and it has no team yet
  (team_id IS NULL AND created_by = auth.uid())
);