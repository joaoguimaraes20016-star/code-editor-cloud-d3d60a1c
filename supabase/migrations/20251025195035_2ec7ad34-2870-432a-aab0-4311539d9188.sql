-- Update RLS policies to give admins and offer_owners full control

-- MRR Schedules: Allow admins and offer owners to delete
DROP POLICY IF EXISTS "Admins and offer owners can manage MRR schedules" ON public.mrr_schedules;
CREATE POLICY "Admins and offer owners can manage MRR schedules"
ON public.mrr_schedules
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR 
    has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR
    has_team_role(auth.uid(), team_id, 'closer'::text)
  )
);

-- MRR Follow-up Tasks: Allow admins and offer owners to delete
DROP POLICY IF EXISTS "Closers and admins can manage MRR follow-up tasks" ON public.mrr_follow_up_tasks;
CREATE POLICY "Admins and offer owners can manage follow-up tasks"
ON public.mrr_follow_up_tasks
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR
    has_team_role(auth.uid(), team_id, 'closer'::text)
  )
);

-- MRR Commissions: Allow admins and offer owners to delete
DROP POLICY IF EXISTS "Team members can delete MRR commissions" ON public.mrr_commissions;
CREATE POLICY "Admins and offer owners can manage MRR commissions"
ON public.mrr_commissions
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text)
  )
);

-- Activity Logs: Allow admins and offer owners to delete
DROP POLICY IF EXISTS "Team members can create activity logs" ON public.activity_logs;
CREATE POLICY "Team members can create and delete activity logs"
ON public.activity_logs
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR
    is_team_member(auth.uid(), team_id)
  )
);

-- Confirmation Tasks: Allow admins and offer owners to delete
DROP POLICY IF EXISTS "Setters and admins can update tasks" ON public.confirmation_tasks;
CREATE POLICY "Admins and offer owners can manage confirmation tasks"
ON public.confirmation_tasks
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin'::text) OR
    has_team_role(auth.uid(), team_id, 'offer_owner'::text) OR
    has_team_role(auth.uid(), team_id, 'setter'::text)
  )
);