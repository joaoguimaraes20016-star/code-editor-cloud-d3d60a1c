
-- Drop the global unique constraint on booking_code
ALTER TABLE team_members DROP CONSTRAINT IF EXISTS team_members_booking_code_key;

-- Add a new unique constraint that's scoped to team_id
-- This allows the same booking code in different teams, but not within the same team
ALTER TABLE team_members 
ADD CONSTRAINT team_members_team_booking_code_unique 
UNIQUE (team_id, booking_code);
