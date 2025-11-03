-- Allow team members to update their own booking_code
CREATE POLICY "Team members can update their own booking code"
ON public.team_members
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);