-- Add fallback confirmation settings for last-minute bookings
ALTER TABLE teams 
ADD COLUMN minimum_booking_notice_hours numeric DEFAULT 24,
ADD COLUMN fallback_confirmation_minutes numeric DEFAULT 60;

COMMENT ON COLUMN teams.minimum_booking_notice_hours IS 'If booking is made with less than this notice, use fallback logic (default 24 hours)';
COMMENT ON COLUMN teams.fallback_confirmation_minutes IS 'Create task due X minutes before appointment for last-minute bookings (default 60 minutes)';