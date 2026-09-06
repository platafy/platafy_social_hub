-- Add AI provider API key columns to zernio_integrations
-- Users configure AI keys once in Settings, not per-automation
ALTER TABLE public.zernio_integrations
  ADD COLUMN IF NOT EXISTS ai_gemini_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_openai_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_anthropic_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_mistral_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_groq_key TEXT;

-- Remove per-automation ai_api_key column (was added by mistake — keys belong in integrations)
ALTER TABLE public.zernio_automations
  DROP COLUMN IF EXISTS ai_api_key;
