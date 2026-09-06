-- Add ai_api_key column to zernio_automations
-- This allows users to store their own AI provider API key per automation rule
ALTER TABLE public.zernio_automations
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT;
