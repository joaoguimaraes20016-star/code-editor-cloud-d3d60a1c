-- Add calendly_signing_key column to teams table
ALTER TABLE teams ADD COLUMN IF NOT EXISTS calendly_signing_key TEXT;