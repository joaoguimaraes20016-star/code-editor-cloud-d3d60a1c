-- Part 1: Fix existing bad data - backfill missing setter_name and closer_name
UPDATE appointments
SET setter_name = profiles.full_name
FROM profiles
WHERE appointments.setter_id = profiles.id
  AND appointments.setter_name IS NULL
  AND appointments.setter_id IS NOT NULL;

UPDATE appointments
SET closer_name = profiles.full_name
FROM profiles
WHERE appointments.closer_id = profiles.id
  AND appointments.closer_name IS NULL
  AND appointments.closer_id IS NOT NULL;

-- Part 2: Create trigger to automatically sync names when IDs are set/changed
CREATE OR REPLACE FUNCTION sync_appointment_names()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync setter_name when setter_id changes
  IF NEW.setter_id IS DISTINCT FROM OLD.setter_id THEN
    IF NEW.setter_id IS NULL THEN
      NEW.setter_name := NULL;
    ELSE
      SELECT full_name INTO NEW.setter_name
      FROM profiles
      WHERE id = NEW.setter_id;
    END IF;
  END IF;
  
  -- Sync closer_name when closer_id changes
  IF NEW.closer_id IS DISTINCT FROM OLD.closer_id THEN
    IF NEW.closer_id IS NULL THEN
      NEW.closer_name := NULL;
    ELSE
      SELECT full_name INTO NEW.closer_name
      FROM profiles
      WHERE id = NEW.closer_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to appointments table
DROP TRIGGER IF EXISTS sync_appointment_names_trigger ON appointments;
CREATE TRIGGER sync_appointment_names_trigger
  BEFORE INSERT OR UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION sync_appointment_names();