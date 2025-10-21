-- Update RLS policies for team_assets to allow offer_owners and admins

-- Drop existing policies
DROP POLICY IF EXISTS "Team members can create team assets" ON team_assets;
DROP POLICY IF EXISTS "Team members can delete team assets" ON team_assets;
DROP POLICY IF EXISTS "Team members can update team assets" ON team_assets;

-- Create policies that include offer_owners and admins
CREATE POLICY "Owners, offer owners and admins can create team assets"
ON team_assets
FOR INSERT
TO authenticated
WITH CHECK (
  is_team_member(auth.uid(), team_id) AND
  (
    has_team_role(auth.uid(), team_id, 'owner'::text) OR
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text)
  )
);

CREATE POLICY "Owners, offer owners and admins can delete team assets"
ON team_assets
FOR DELETE
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND
  (
    has_team_role(auth.uid(), team_id, 'owner'::text) OR
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text)
  )
);

CREATE POLICY "Owners, offer owners and admins can update team assets"
ON team_assets
FOR UPDATE
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND
  (
    has_team_role(auth.uid(), team_id, 'owner'::text) OR
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text)
  )
);