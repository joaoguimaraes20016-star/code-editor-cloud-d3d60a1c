-- Add Calendly usage toggle settings to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS calendly_enabled_for_funnels boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS calendly_enabled_for_crm boolean DEFAULT false;