-- Update the can_create_teams function to allow all authenticated users
-- Since signup requires a valid code, anyone who signs up should be able to create teams
CREATE OR REPLACE FUNCTION public.can_create_teams(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Allow all authenticated users to create teams
  SELECT _user_id IS NOT NULL
$$;