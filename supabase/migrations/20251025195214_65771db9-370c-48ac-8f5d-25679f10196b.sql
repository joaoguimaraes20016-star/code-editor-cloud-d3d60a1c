-- Drop all existing policies first then recreate with full admin/offer_owner access

-- MRR Schedules
DROP POLICY IF EXISTS "Admins and offer owners can manage MRR schedules" ON public.mrr_schedules;
DROP POLICY IF EXISTS "Team members can view MRR schedules" ON public.mrr_schedules;

CREATE POLICY "Admins and offer owners full access to MRR schedules"
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

-- MRR Follow-up Tasks  
DROP POLICY IF EXISTS "Admins and offer owners can manage follow-up tasks" ON public.mrr_follow_up_tasks;
DROP POLICY IF EXISTS "Team members can view MRR follow-up tasks" ON public.mrr_follow_up_tasks;

CREATE POLICY "Full access to MRR follow-up tasks"
ON public.mrr_follow_up_tasks
FOR ALL
TO authenticated
USING (
  is_team_member(auth.uid(), team_id)
);

-- MRR Commissions
DROP POLICY IF EXISTS "Admins and offer owners can manage MRR commissions" ON public.mrr_commissions;
DROP POLICY IF EXISTS "Team members can view MRR commissions" ON public.mrr_commissions;
DROP POLICY IF EXISTS "Team members can create MRR commissions" ON public.mrr_commissions;
DROP POLICY IF EXISTS "Team members can update MRR commissions" ON public.mrr_commissions;

CREATE POLICY "Full access to MRR commissions"
ON public.mrr_commissions
FOR ALL
TO authenticated
USING (is_team_member(auth.uid(), team_id));

-- Activity Logs
DROP POLICY IF EXISTS "Team members can create and delete activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Team members can view activity logs" ON public.activity_logs;

CREATE POLICY "Full access to activity logs"
ON public.activity_logs
FOR ALL
TO authenticated
USING (is_team_member(auth.uid(), team_id));

-- Confirmation Tasks
DROP POLICY IF EXISTS "Admins and offer owners can manage confirmation tasks" ON public.confirmation_tasks;
DROP POLICY IF EXISTS "Team members can view tasks" ON public.confirmation_tasks;
DROP POLICY IF EXISTS "Team members can create tasks" ON public.confirmation_tasks;

CREATE POLICY "Full access to confirmation tasks"
ON public.confirmation_tasks
FOR ALL
TO authenticated
USING (is_team_member(auth.uid(), team_id));