-- Add columns to track lead history context for rebooking detection
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS original_booking_date timestamptz DEFAULT NULL;

-- Track the type of rebooking for badge display
-- Values: 'returning_client', 'win_back', 'rebooking', 'reschedule'
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS rebooking_type text DEFAULT NULL;

-- Track what happened with the previous appointment
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS previous_status text DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN appointments.rebooking_type IS 'Type of rebooking: returning_client, win_back, rebooking, reschedule';
COMMENT ON COLUMN appointments.previous_status IS 'Pipeline stage of the previous appointment when rebooking detected';