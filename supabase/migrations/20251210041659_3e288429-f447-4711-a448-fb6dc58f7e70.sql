-- Add dns_www_valid column to track www subdomain verification separately
ALTER TABLE public.funnel_domains 
ADD COLUMN IF NOT EXISTS dns_www_valid boolean DEFAULT false;