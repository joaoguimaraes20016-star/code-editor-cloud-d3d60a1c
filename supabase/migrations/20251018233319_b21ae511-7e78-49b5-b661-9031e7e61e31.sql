-- Update the handle_new_user_role trigger to assign creator role if creator code was used
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  creator_code_used text;
BEGIN
  -- Get creator code from user metadata
  creator_code_used := NEW.raw_user_meta_data->>'creator_code';
  
  -- If user signed up with a valid creator code, assign 'creator' role
  IF creator_code_used IS NOT NULL AND creator_code_used != '' THEN
    -- Verify the code exists and is active
    IF EXISTS (
      SELECT 1 FROM public.creator_codes 
      WHERE code = UPPER(creator_code_used) AND is_active = true
    ) THEN
      INSERT INTO public.user_roles (user_id, role)
      VALUES (NEW.id, 'creator'::global_role);
      RETURN NEW;
    END IF;
  END IF;
  
  -- Otherwise assign 'member' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'member'::global_role);
  
  RETURN NEW;
END;
$function$;