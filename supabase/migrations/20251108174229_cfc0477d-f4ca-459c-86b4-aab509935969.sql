-- Phase 1: Remove duplicate trigger that's causing failures
DROP TRIGGER IF EXISTS on_appointment_created ON appointments;

-- Verify the correct trigger exists and is active
-- The trigger_auto_create_confirmation_task should remain active
COMMENT ON TRIGGER trigger_auto_create_confirmation_task ON appointments IS 
'Primary trigger for creating confirmation tasks with proper due_at calculation';