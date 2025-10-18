-- Add booking_code column to team_members table for personalized setter links
ALTER TABLE public.team_members 
ADD COLUMN booking_code TEXT UNIQUE;

-- Create index for efficient lookups by booking_code
CREATE INDEX idx_team_members_booking_code 
ON public.team_members(booking_code) 
WHERE booking_code IS NOT NULL;

-- Add helpful comment explaining the column's purpose
COMMENT ON COLUMN public.team_members.booking_code IS 'Unique code used in personalized Calendly booking links for automatic appointment assignment. Format: setter_{code}';
