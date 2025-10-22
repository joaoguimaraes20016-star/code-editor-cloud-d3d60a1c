-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view their own client assets by email" ON client_assets;
DROP POLICY IF EXISTS "Users can view their own asset fields by email" ON client_asset_fields;
DROP POLICY IF EXISTS "Users can update their own asset fields by email" ON client_asset_fields;

-- Create new policies using JWT email
CREATE POLICY "Users can view their own client assets by email"
ON client_assets
FOR SELECT
USING (
  client_email = auth.jwt()->>'email'
);

CREATE POLICY "Users can view their own asset fields by email"
ON client_asset_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND ca.client_email = auth.jwt()->>'email'
  )
);

CREATE POLICY "Users can update their own asset fields by email"
ON client_asset_fields
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND ca.client_email = auth.jwt()->>'email'
  )
);