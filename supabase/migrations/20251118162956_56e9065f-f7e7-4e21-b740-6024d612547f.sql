-- Add missing fields to confirmation_tasks for reschedule tracking
ALTER TABLE confirmation_tasks 
ADD COLUMN IF NOT EXISTS reschedule_reason TEXT,
ADD COLUMN IF NOT EXISTS reschedule_notes TEXT;