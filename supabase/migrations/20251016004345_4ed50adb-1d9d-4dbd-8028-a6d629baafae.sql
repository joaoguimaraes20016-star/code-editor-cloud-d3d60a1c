-- Fix RLS policy for team_members to allow team creators to add themselves as owners
DROP POLICY IF EXISTS "Users can add themselves or owners can add members" ON public.team_members;

CREATE POLICY "Users can add themselves or owners can add members" 
ON public.team_members 
FOR INSERT 
WITH CHECK (
  (auth.uid() = user_id) OR 
  is_team_owner(auth.uid(), team_id) OR
  (EXISTS (
    SELECT 1 FROM public.teams 
    WHERE teams.id = team_members.team_id 
    AND teams.created_by = auth.uid()
  ))
);