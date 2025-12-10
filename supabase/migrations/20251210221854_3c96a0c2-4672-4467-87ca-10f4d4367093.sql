-- Add avatar_url to profiles for team member profile pictures
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Add logo_url to teams for team/offer branding
ALTER TABLE teams ADD COLUMN IF NOT EXISTS logo_url text;