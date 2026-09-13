-- Migration: Add comment reply fields to zernio_automations for dual comment-to-dm response
ALTER TABLE public.zernio_automations
  ADD COLUMN IF NOT EXISTS comment_reply_enabled BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS comment_reply_text TEXT;

-- Comment on columns for documentation
COMMENT ON COLUMN public.zernio_automations.comment_reply_enabled IS 'Indica se alem de enviar a DM, deve responder publicamente no comentario da postagem';
COMMENT ON COLUMN public.zernio_automations.comment_reply_text IS 'Texto da resposta publica enviada no comentario da postagem';
