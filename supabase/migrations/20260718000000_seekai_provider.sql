-- Add SeekAI API key column to zernio_integrations
-- SeekAI is an OpenAI-compatible AI gateway (https://seekai.cc)
ALTER TABLE public.zernio_integrations
  ADD COLUMN IF NOT EXISTS ai_seekai_key TEXT;
