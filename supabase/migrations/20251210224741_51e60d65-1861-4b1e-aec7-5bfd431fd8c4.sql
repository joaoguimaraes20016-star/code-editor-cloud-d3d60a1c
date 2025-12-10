-- Add phone number to profiles for future calling integration
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number text;