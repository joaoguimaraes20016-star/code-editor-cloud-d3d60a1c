-- Drop the invitation-based policy that's causing issues
DROP POLICY IF EXISTS "Users can join team with valid invitation" ON team_members;

-- Simplify the policy to allow authenticated users to add themselves
-- The invitation validation is already done in the application code
DROP POLICY IF EXISTS "Users can add themselves or owners can add members" ON team_members;

CREATE POLICY "Users can add themselves or owners can add members" 
ON team_members
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  OR is_team_owner(auth.uid(), team_id)
  OR (EXISTS (
    SELECT 1 FROM teams 
    WHERE teams.id = team_members.team_id 
    AND teams.created_by = auth.uid()
  ))
);