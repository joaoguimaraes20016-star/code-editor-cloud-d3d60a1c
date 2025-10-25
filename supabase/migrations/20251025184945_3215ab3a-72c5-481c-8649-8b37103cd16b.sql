-- Create MRR follow-up schedules table
CREATE TABLE public.mrr_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  appointment_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  mrr_amount NUMERIC NOT NULL,
  first_charge_date DATE NOT NULL,
  next_renewal_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  assigned_to UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

-- Create MRR follow-up tasks table
CREATE TABLE public.mrr_follow_up_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL,
  mrr_schedule_id UUID NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'due',
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mrr_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mrr_follow_up_tasks ENABLE ROW LEVEL SECURITY;

-- RLS policies for mrr_schedules
CREATE POLICY "Team members can view MRR schedules"
  ON public.mrr_schedules
  FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Admins and offer owners can manage MRR schedules"
  ON public.mrr_schedules
  FOR ALL
  USING (is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin') OR 
    has_team_role(auth.uid(), team_id, 'offer_owner') OR
    has_team_role(auth.uid(), team_id, 'closer')
  ));

-- RLS policies for mrr_follow_up_tasks
CREATE POLICY "Team members can view MRR follow-up tasks"
  ON public.mrr_follow_up_tasks
  FOR SELECT
  USING (is_team_member(auth.uid(), team_id));

CREATE POLICY "Closers and admins can manage MRR follow-up tasks"
  ON public.mrr_follow_up_tasks
  FOR ALL
  USING (is_team_member(auth.uid(), team_id) AND (
    has_team_role(auth.uid(), team_id, 'admin') OR 
    has_team_role(auth.uid(), team_id, 'offer_owner') OR
    has_team_role(auth.uid(), team_id, 'closer')
  ));

-- Create indexes
CREATE INDEX idx_mrr_schedules_team_id ON public.mrr_schedules(team_id);
CREATE INDEX idx_mrr_schedules_status ON public.mrr_schedules(status);
CREATE INDEX idx_mrr_schedules_next_renewal ON public.mrr_schedules(next_renewal_date);
CREATE INDEX idx_mrr_follow_up_tasks_team_id ON public.mrr_follow_up_tasks(team_id);
CREATE INDEX idx_mrr_follow_up_tasks_due_date ON public.mrr_follow_up_tasks(due_date);
CREATE INDEX idx_mrr_follow_up_tasks_status ON public.mrr_follow_up_tasks(status);

-- Function to create next month's follow-up task
CREATE OR REPLACE FUNCTION public.create_next_mrr_follow_up()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When a task is completed, create next month's task
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    INSERT INTO mrr_follow_up_tasks (
      team_id,
      mrr_schedule_id,
      due_date,
      status
    ) VALUES (
      NEW.team_id,
      NEW.mrr_schedule_id,
      NEW.due_date + INTERVAL '1 month',
      'due'
    );
    
    -- Update the MRR schedule's next renewal date
    UPDATE mrr_schedules
    SET next_renewal_date = NEW.due_date + INTERVAL '1 month',
        updated_at = now()
    WHERE id = NEW.mrr_schedule_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-create next month's task
CREATE TRIGGER auto_create_next_mrr_task
  AFTER UPDATE ON public.mrr_follow_up_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.create_next_mrr_follow_up();