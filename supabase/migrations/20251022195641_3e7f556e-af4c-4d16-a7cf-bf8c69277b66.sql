-- Drop the existing delete policy
DROP POLICY IF EXISTS "Admins can delete appointments" ON public.appointments;

-- Create new delete policy that allows team admins, creators, and super admins
CREATE POLICY "Admins, creators, and super admins can delete appointments"
ON public.appointments
FOR DELETE
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_global_role(auth.uid(), 'creator'::global_role) OR
    has_global_role(auth.uid(), 'super_admin'::global_role)
  )
);