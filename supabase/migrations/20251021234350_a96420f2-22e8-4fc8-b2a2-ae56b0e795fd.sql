-- Allow users to view their own client asset fields by email
CREATE POLICY "Users can view their own asset fields by email"
ON client_asset_fields
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND ca.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);

-- Allow users to update their own client asset fields by email
CREATE POLICY "Users can update their own asset fields by email"
ON client_asset_fields
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_fields.client_asset_id
    AND ca.client_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  )
);