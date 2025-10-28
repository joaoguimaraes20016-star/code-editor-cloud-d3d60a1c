-- Grant service_role full permissions on appointments table
GRANT ALL ON public.appointments TO service_role;

-- Create RLS policy to allow service_role to bypass RLS for inserts
CREATE POLICY "Service role bypass for batch inserts"
ON public.appointments
FOR INSERT
TO service_role
WITH CHECK (true);