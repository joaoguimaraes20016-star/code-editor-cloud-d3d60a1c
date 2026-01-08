-- Phase 17: Builder V2 canonical columns
ALTER TABLE public.funnels
ADD COLUMN IF NOT EXISTS builder_document jsonb;

ALTER TABLE public.funnels
ADD COLUMN IF NOT EXISTS published_document_snapshot jsonb;

COMMENT ON COLUMN public.funnels.builder_document IS 'Builder V2 draft document (EditorDocument JSON)';
COMMENT ON COLUMN public.funnels.published_document_snapshot IS 'PublishedDocumentSnapshot JSON used by runtime + automations';
