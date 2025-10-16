-- Add google_sheets_url to teams table
ALTER TABLE public.teams 
ADD COLUMN google_sheets_url text;

-- Update RLS policy to allow owners to update the google_sheets_url
-- The existing policy already allows owners to update, so no change needed there

-- Create edge function to sync appointments from Google Sheets
-- This will be handled in the edge function code