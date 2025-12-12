-- Create message_logs table for SMS/email logging
CREATE TABLE public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  automation_id uuid REFERENCES public.automations(id) ON DELETE SET NULL,
  run_id uuid,
  channel text NOT NULL,
  provider text NOT NULL,
  to_address text NOT NULL,
  from_address text,
  template text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

-- Policy: team admins can read all message_logs for their team
CREATE POLICY "Team members can read message logs"
ON public.message_logs
FOR SELECT
USING (is_team_member(auth.uid(), team_id));

-- Index for efficient team queries
CREATE INDEX idx_message_logs_team_created ON public.message_logs(team_id, created_at DESC);