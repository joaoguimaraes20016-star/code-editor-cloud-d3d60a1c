-- Add NO_SHOW to the appointment_status enum
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'NO_SHOW';