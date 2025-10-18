-- Create webhook audit logs table for security monitoring
CREATE TABLE IF NOT EXISTS public.webhook_audit_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('success', 'error')),
  details JSONB,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.webhook_audit_logs ENABLE ROW LEVEL SECURITY;

-- Only team owners and admins can view audit logs
CREATE POLICY "Team owners and admins can view audit logs"
ON public.webhook_audit_logs
FOR SELECT
USING (
  is_team_member(auth.uid(), team_id) AND 
  (has_team_role(auth.uid(), team_id, 'owner') OR has_team_role(auth.uid(), team_id, 'admin'))
);

-- Create index for faster queries
CREATE INDEX idx_webhook_audit_logs_team_id ON public.webhook_audit_logs(team_id);
CREATE INDEX idx_webhook_audit_logs_created_at ON public.webhook_audit_logs(created_at DESC);