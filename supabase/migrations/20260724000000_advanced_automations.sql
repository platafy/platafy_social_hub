-- Migration: Advanced Automations (Ads, Stories, Auto-Engage, AI Moderation)

ALTER TABLE public.zernio_automations
  ADD COLUMN IF NOT EXISTS target_scope TEXT DEFAULT 'all', -- 'all', 'organic', 'ads'
  ADD COLUMN IF NOT EXISTS target_ad_ids TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS auto_like_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_heart_enabled BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_moderate_spam BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_pin_comment BOOLEAN DEFAULT false;

COMMENT ON COLUMN public.zernio_automations.target_scope IS 'Escopo de disparo: all (todos), organic (apenas posts normais), ads (apenas anuncios/dark posts)';
COMMENT ON COLUMN public.zernio_automations.auto_like_enabled IS 'Se verdadeiro, da like automatico no comentario do usuario';
COMMENT ON COLUMN public.zernio_automations.auto_heart_enabled IS 'Se verdadeiro, coloca o coracao oficial do canal no comentario (YouTube)';
COMMENT ON COLUMN public.zernio_automations.auto_moderate_spam IS 'Se verdadeiro, oculta automaticamente comentarios identificados como spam, ofensa ou concorrente';
COMMENT ON COLUMN public.zernio_automations.auto_pin_comment IS 'Se verdadeiro, fixa o comentario da pagina/canal no topo';
