-- Add Builder V2 document columns to funnels table
ALTER TABLE public.funnels
ADD COLUMN IF NOT EXISTS builder_document jsonb;

ALTER TABLE public.funnels
ADD COLUMN IF NOT EXISTS published_document_snapshot jsonb;

-- Add comment for documentation
COMMENT ON COLUMN public.funnels.builder_document IS 'Builder V2 editor document (pages, nodes, activePageId)';
COMMENT ON COLUMN public.funnels.published_document_snapshot IS 'Published runtime snapshot with legacy payload for rendering';