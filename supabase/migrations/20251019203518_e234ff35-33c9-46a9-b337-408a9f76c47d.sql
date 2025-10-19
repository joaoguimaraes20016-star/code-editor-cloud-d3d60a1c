-- Allow team owners and creators to delete their teams
CREATE POLICY "Team owners can delete their teams"
ON public.teams
FOR DELETE
USING (
  is_team_owner(auth.uid(), id) OR 
  created_by = auth.uid()
);