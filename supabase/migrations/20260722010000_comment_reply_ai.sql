-- Migration: Add comment reply provider and prompt to zernio_automations
ALTER TABLE public.zernio_automations
  ADD COLUMN IF NOT EXISTS comment_reply_provider TEXT DEFAULT 'static',
  ADD COLUMN IF NOT EXISTS comment_reply_prompt TEXT;

-- Comments for documentation
COMMENT ON COLUMN public.zernio_automations.comment_reply_provider IS 'Provedor de resposta no comentario: static, gemini, openai, anthropic, seekai, mistral, groq';
COMMENT ON COLUMN public.zernio_automations.comment_reply_prompt IS 'Instrucao / Prompt para a IA responder o comentario publico';
