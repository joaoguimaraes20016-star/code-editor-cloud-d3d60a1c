-- Drop the existing check constraint
ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_status_check;

-- Add updated check constraint that includes 'running' status
ALTER TABLE public.automation_runs ADD CONSTRAINT automation_runs_status_check CHECK (status = ANY (ARRAY['success'::text, 'error'::text, 'running'::text]));