-- Ensure pgcrypto extension for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Ensure funnel_steps.id always has a server-side UUID default
ALTER TABLE public.funnel_steps
  ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- Fix trigger function to never null out NEW.id and to always
-- ensure a UUID is present server-side.
CREATE OR REPLACE FUNCTION public.ignore_client_step_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- If the client did not provide an id, generate one server-side
  IF NEW.id IS NULL THEN
    NEW.id := gen_random_uuid();
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the funnel_steps_id_guard trigger exists and uses the
-- updated ignore_client_step_id function. This block is idempotent
-- and safe to run multiple times.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'funnel_steps_id_guard'
      AND tgrelid = 'public.funnel_steps'::regclass
  ) THEN
    CREATE TRIGGER funnel_steps_id_guard
    BEFORE INSERT ON public.funnel_steps
    FOR EACH ROW
    EXECUTE FUNCTION public.ignore_client_step_id();
  END IF;
END;
$$;
