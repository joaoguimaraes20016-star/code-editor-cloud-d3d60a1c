-- Function to initialize default pipeline stages for a team
CREATE OR REPLACE FUNCTION public.initialize_default_pipeline_stages()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert default stages for the new team
  INSERT INTO public.team_pipeline_stages (team_id, stage_id, stage_label, stage_color, order_index, is_default)
  VALUES
    (NEW.id, 'booked', 'Appointment Booked', '#3b82f6', 0, true),
    (NEW.id, 'no_show', 'No-Show', '#f97316', 1, true),
    (NEW.id, 'canceled', 'Canceled', '#6b7280', 2, true),
    (NEW.id, 'rescheduled', 'Rescheduled', '#eab308', 3, true),
    (NEW.id, 'deposit', 'Deposit Collected', '#14b8a6', 4, true),
    (NEW.id, 'won', 'Closed', '#22c55e', 5, true),
    (NEW.id, 'disqualified', 'Disqualified', '#ef4444', 6, true)
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-initialize stages for new teams
DROP TRIGGER IF EXISTS trigger_initialize_pipeline_stages ON public.teams;
CREATE TRIGGER trigger_initialize_pipeline_stages
  AFTER INSERT ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_default_pipeline_stages();

-- Backfill default stages for existing teams that don't have any stages
DO $$
DECLARE
  team_record RECORD;
BEGIN
  FOR team_record IN 
    SELECT t.id 
    FROM public.teams t
    LEFT JOIN public.team_pipeline_stages tps ON tps.team_id = t.id
    WHERE tps.id IS NULL
    GROUP BY t.id
  LOOP
    INSERT INTO public.team_pipeline_stages (team_id, stage_id, stage_label, stage_color, order_index, is_default)
    VALUES
      (team_record.id, 'booked', 'Appointment Booked', '#3b82f6', 0, true),
      (team_record.id, 'no_show', 'No-Show', '#f97316', 1, true),
      (team_record.id, 'canceled', 'Canceled', '#6b7280', 2, true),
      (team_record.id, 'rescheduled', 'Rescheduled', '#eab308', 3, true),
      (team_record.id, 'deposit', 'Deposit Collected', '#14b8a6', 4, true),
      (team_record.id, 'won', 'Closed', '#22c55e', 5, true),
      (team_record.id, 'disqualified', 'Disqualified', '#ef4444', 6, true)
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;