-- Create password reset tokens table
CREATE TABLE public.password_reset_tokens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;

-- Create index for faster token lookups
CREATE INDEX idx_password_reset_tokens_token ON public.password_reset_tokens(token);
CREATE INDEX idx_password_reset_tokens_expires_at ON public.password_reset_tokens(expires_at);

-- RLS Policies
CREATE POLICY "Users can view their own reset tokens" 
ON public.password_reset_tokens 
FOR SELECT 
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

CREATE POLICY "Service role can manage all tokens" 
ON public.password_reset_tokens 
FOR ALL 
USING (true);

-- Function to cleanup expired tokens
CREATE OR REPLACE FUNCTION public.cleanup_expired_reset_tokens()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.password_reset_tokens
  WHERE expires_at < now() OR used_at IS NOT NULL;
END;
$$;

-- Trigger to auto-cleanup on insert
CREATE OR REPLACE FUNCTION public.auto_cleanup_reset_tokens()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.cleanup_expired_reset_tokens();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_auto_cleanup_reset_tokens
BEFORE INSERT ON public.password_reset_tokens
FOR EACH STATEMENT
EXECUTE FUNCTION public.auto_cleanup_reset_tokens();