-- Drop existing storage policies for client-assets bucket
DROP POLICY IF EXISTS "Anyone can upload during onboarding" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view asset files in storage" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can delete files from storage" ON storage.objects;

-- Create storage policies for client-assets bucket
CREATE POLICY "Anyone can upload to client-assets"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'client-assets');

CREATE POLICY "Anyone can view client-assets"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-assets');

CREATE POLICY "Team members can delete from client-assets"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-assets'
  AND auth.uid() IS NOT NULL
);