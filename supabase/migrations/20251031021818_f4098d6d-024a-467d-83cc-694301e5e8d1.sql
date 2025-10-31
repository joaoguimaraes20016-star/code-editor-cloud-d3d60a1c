-- Update RLS policy for mrr_schedules to include owner role
DROP POLICY IF EXISTS "Admins and offer owners full access to MRR schedules" ON mrr_schedules;

CREATE POLICY "Team leadership full access to MRR schedules"
ON mrr_schedules
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin') OR
    has_team_role(auth.uid(), team_id, 'offer_owner') OR
    has_team_role(auth.uid(), team_id, 'owner') OR
    has_team_role(auth.uid(), team_id, 'closer')
  )
);