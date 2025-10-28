-- Drop existing policies that restrict to closers and admins only
DROP POLICY IF EXISTS "Closers and admins can update appointment status" ON appointments;
DROP POLICY IF EXISTS "Closers and admins can update deposit fields" ON appointments;

-- Create new policies that include offer_owner role
CREATE POLICY "Closers, admins, and offer owners can update appointment status"
ON appointments
FOR UPDATE
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'closer') OR
    has_team_role(auth.uid(), team_id, 'admin') OR
    has_team_role(auth.uid(), team_id, 'offer_owner')
  )
);

CREATE POLICY "Closers, admins, and offer owners can update deposit fields"
ON appointments
FOR UPDATE
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'closer') OR
    has_team_role(auth.uid(), team_id, 'admin') OR
    has_team_role(auth.uid(), team_id, 'offer_owner')
  )
)
WITH CHECK (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'closer') OR
    has_team_role(auth.uid(), team_id, 'admin') OR
    has_team_role(auth.uid(), team_id, 'offer_owner')
  )
);