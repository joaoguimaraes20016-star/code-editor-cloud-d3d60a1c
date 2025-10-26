-- Clear invalid signing keys from teams table
UPDATE teams 
SET calendly_signing_key = NULL 
WHERE calendly_signing_key IS NOT NULL 
  AND (calendly_signing_key LIKE '%Please allow popups%' OR LENGTH(calendly_signing_key) < 20);

-- Remove the calendly_signing_key column as we use environment variable instead
ALTER TABLE teams DROP COLUMN IF EXISTS calendly_signing_key;