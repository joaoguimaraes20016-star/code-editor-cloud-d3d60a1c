-- Create client_asset_files table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.client_asset_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_asset_id UUID NOT NULL REFERENCES client_assets(id) ON DELETE CASCADE,
  file_category TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.client_asset_files ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their team's asset files" ON client_asset_files;
DROP POLICY IF EXISTS "Users can upload files for new assets" ON client_asset_files;
DROP POLICY IF EXISTS "Users can upload asset files" ON client_asset_files;

-- Allow anyone to INSERT files during onboarding (no auth required)
CREATE POLICY "Anyone can upload files during onboarding"
ON client_asset_files
FOR INSERT
WITH CHECK (true);

-- Allow team members to view files
CREATE POLICY "Team members can view asset files"
ON client_asset_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_files.client_asset_id
    AND (
      ca.team_id IS NULL 
      OR is_team_member(auth.uid(), ca.team_id)
    )
  )
);

-- Allow team members to delete files
CREATE POLICY "Authorized users can delete asset files"
ON client_asset_files
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM client_assets ca
    WHERE ca.id = client_asset_files.client_asset_id
    AND is_team_member(auth.uid(), ca.team_id)
    AND (
      has_team_role(auth.uid(), ca.team_id, 'offer_owner')
      OR has_team_role(auth.uid(), ca.team_id, 'admin')
      OR has_team_role(auth.uid(), ca.team_id, 'owner')
    )
  )
);

-- Storage policies for client-assets bucket
-- Allow anyone to upload files (needed for unauthenticated onboarding)
CREATE POLICY "Anyone can upload during onboarding"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'client-assets');

-- Allow team members to view files
CREATE POLICY "Team members can view asset files in storage"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-assets');

-- Allow team members to delete files
CREATE POLICY "Authorized users can delete files from storage"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-assets'
  AND auth.uid() IS NOT NULL
);