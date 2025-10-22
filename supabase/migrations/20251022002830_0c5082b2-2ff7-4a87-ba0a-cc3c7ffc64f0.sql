-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Team members can create team assets" ON team_assets;
DROP POLICY IF EXISTS "All team members can view team assets" ON team_assets;
DROP POLICY IF EXISTS "Team members can update their own assets" ON team_assets;
DROP POLICY IF EXISTS "Team members can delete their own assets" ON team_assets;
DROP POLICY IF EXISTS "Team members can upload team assets" ON storage.objects;
DROP POLICY IF EXISTS "Team members can view team assets" ON storage.objects;
DROP POLICY IF EXISTS "Team members can delete team assets" ON storage.objects;

-- Recreate restrictive policies for team_assets
CREATE POLICY "Admins and owners can create team assets"
ON team_assets
FOR INSERT
WITH CHECK (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'admin'::text))
);

CREATE POLICY "Admins and owners can update team assets"
ON team_assets
FOR UPDATE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'admin'::text))
);

CREATE POLICY "Admins and owners can delete team assets"
ON team_assets
FOR DELETE
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR 
   has_team_role(auth.uid(), team_id, 'admin'::text))
);

-- Recreate storage policies
CREATE POLICY "Admins and owners can upload team assets"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'team-assets' AND
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.team_id::text = (storage.foldername(name))[1]
    AND tm.role IN ('owner', 'admin', 'offer_owner')
  )
);

CREATE POLICY "Admins and owners can delete team asset files"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'team-assets' AND
  EXISTS (
    SELECT 1 FROM team_members tm
    WHERE tm.user_id = auth.uid()
    AND tm.team_id::text = (storage.foldername(name))[1]
    AND tm.role IN ('owner', 'admin', 'offer_owner')
  )
);