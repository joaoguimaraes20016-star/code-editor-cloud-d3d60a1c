-- Drop the existing check constraint
ALTER TABLE public.funnel_steps DROP CONSTRAINT IF EXISTS funnel_steps_step_type_check;

-- Add the updated check constraint including opt_in
ALTER TABLE public.funnel_steps ADD CONSTRAINT funnel_steps_step_type_check 
CHECK (step_type IN ('welcome', 'text_question', 'multi_choice', 'email_capture', 'phone_capture', 'video', 'thank_you', 'opt_in'));