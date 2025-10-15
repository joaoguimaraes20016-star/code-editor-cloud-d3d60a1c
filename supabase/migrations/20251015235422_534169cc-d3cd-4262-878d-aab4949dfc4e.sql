-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Team owners can insert members" ON public.team_members;

-- Create new policy that allows team creators to add themselves and owners to add others
CREATE POLICY "Users can add themselves or owners can add members"
  ON public.team_members FOR INSERT
  WITH CHECK (
    -- Allow users to add themselves as a member
    auth.uid() = user_id
    OR
    -- Or allow existing owners to add new members
    public.is_team_owner(auth.uid(), team_id)
  );