-- Update RLS policy to allow creating fields for client assets without teams
DROP POLICY IF EXISTS "Authorized users can modify fields" ON client_asset_fields;

-- Allow INSERT for assets without teams or for team members with proper role
CREATE POLICY "Users can create fields for new client assets"
ON client_asset_fields
FOR INSERT
WITH CHECK (
  -- Allow creation for client assets without a team (during initial setup)
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND ca.team_id IS NULL
  )
  OR
  -- Or require team membership with appropriate role
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND is_team_member(auth.uid(), ca.team_id)
    AND (
      has_team_role(auth.uid(), ca.team_id, 'offer_owner')
      OR has_team_role(auth.uid(), ca.team_id, 'admin')
      OR has_team_role(auth.uid(), ca.team_id, 'owner')
    )
  )
);

-- Separate policy for UPDATE and DELETE
CREATE POLICY "Authorized users can modify fields"
ON client_asset_fields
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND is_team_member(auth.uid(), ca.team_id)
    AND (
      has_team_role(auth.uid(), ca.team_id, 'offer_owner')
      OR has_team_role(auth.uid(), ca.team_id, 'admin')
      OR has_team_role(auth.uid(), ca.team_id, 'owner')
    )
  )
);

CREATE POLICY "Authorized users can delete fields"
ON client_asset_fields
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND is_team_member(auth.uid(), ca.team_id)
    AND (
      has_team_role(auth.uid(), ca.team_id, 'offer_owner')
      OR has_team_role(auth.uid(), ca.team_id, 'admin')
      OR has_team_role(auth.uid(), ca.team_id, 'owner')
    )
  )
);