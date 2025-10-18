-- Update RLS policies to allow super admins to change team member roles
DROP POLICY IF EXISTS "Super admins can update any team member role" ON public.team_members;
CREATE POLICY "Super admins can update any team member role"
ON public.team_members
FOR UPDATE
USING (has_global_role(auth.uid(), 'super_admin'::global_role))
WITH CHECK (has_global_role(auth.uid(), 'super_admin'::global_role));

-- Create a table to store valid creator codes
CREATE TABLE IF NOT EXISTS public.creator_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  is_active boolean DEFAULT true,
  uses_count integer DEFAULT 0
);

ALTER TABLE public.creator_codes ENABLE ROW LEVEL SECURITY;

-- Only super admins can manage creator codes
CREATE POLICY "Super admins can manage creator codes"
ON public.creator_codes
FOR ALL
USING (has_global_role(auth.uid(), 'super_admin'::global_role));

-- Insert a default creator code
INSERT INTO public.creator_codes (code, is_active)
VALUES ('CREATOR2025', true)
ON CONFLICT (code) DO NOTHING;

-- Update user sign up to check creator code and assign appropriate role
-- This will be handled in the signup logic in the frontend