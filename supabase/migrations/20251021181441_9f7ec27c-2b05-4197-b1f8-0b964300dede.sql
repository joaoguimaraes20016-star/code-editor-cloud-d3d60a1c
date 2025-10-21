-- Make team_id nullable in client_assets table since teams are created during onboarding
ALTER TABLE client_assets ALTER COLUMN team_id DROP NOT NULL;