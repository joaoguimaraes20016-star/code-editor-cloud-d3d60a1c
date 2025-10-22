-- Add placeholder_text and help_text columns to client_asset_fields table
ALTER TABLE public.client_asset_fields 
ADD COLUMN placeholder_text TEXT,
ADD COLUMN help_text TEXT;