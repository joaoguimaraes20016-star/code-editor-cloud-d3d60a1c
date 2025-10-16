-- Add policy to allow setters to assign unassigned appointments
CREATE POLICY "Setters can assign unassigned appointments"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND 
  setter_id IS NULL AND
  has_team_role(auth.uid(), team_id, 'setter'::text)
)
WITH CHECK (
  is_team_member(auth.uid(), team_id) AND
  has_team_role(auth.uid(), team_id, 'setter'::text)
);