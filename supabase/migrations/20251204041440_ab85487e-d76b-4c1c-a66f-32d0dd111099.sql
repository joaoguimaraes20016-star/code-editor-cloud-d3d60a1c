-- Add action to pipeline stage mappings
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS action_pipeline_mappings jsonb DEFAULT '{
  "double_book": "booked",
  "rebook": "booked",
  "no_show": "no_show",
  "cancelled": "canceled",
  "rescheduled": "rescheduled",
  "no_answer": null
}'::jsonb;