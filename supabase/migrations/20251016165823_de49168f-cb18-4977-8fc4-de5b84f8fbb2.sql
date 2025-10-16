-- Allow users to add themselves to teams if they have a valid invitation
CREATE POLICY "Users can join team with valid invitation"
ON team_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1
    FROM team_invitations
    WHERE team_invitations.team_id = team_members.team_id
      AND team_invitations.email = (SELECT email FROM auth.users WHERE id = auth.uid())
      AND team_invitations.accepted_at IS NULL
      AND team_invitations.expires_at > now()
  )
);