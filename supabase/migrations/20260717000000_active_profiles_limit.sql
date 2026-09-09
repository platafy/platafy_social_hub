-- Migration: Atualização dos limites comerciais para Perfis Ativos (1 Perfil = até 2 contas sociais via Zernio)
-- Data: 2026-07-17

-- 1. Atualizar Starter: 1 Perfil Ativo (até 2 contas)
UPDATE public.plans
SET 
  limits = jsonb_set(
    jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_profiles}', '1'::jsonb, true),
    '{max_channels}', '2'::jsonb, true
  ),
  features = '[
    "1 Perfil Ativo (até 2 contas sociais)",
    "50 posts agendados por mês",
    "Inbox e DMs unificados",
    "Gestão de até 100 contatos",
    "Suporte por e-mail"
  ]'::jsonb
WHERE slug = 'starter';

-- 2. Atualizar Pro: 5 Perfis Ativos (até 10 contas)
UPDATE public.plans
SET 
  limits = jsonb_set(
    jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_profiles}', '5'::jsonb, true),
    '{max_channels}', '10'::jsonb, true
  ),
  features = '[
    "Até 5 Perfis Ativos (até 10 contas sociais)",
    "Publicações e agendamentos ilimitados",
    "Automação com IA (Gemini, OpenAI, Claude)",
    "Moderação inteligente de comentários",
    "CRM completo de contatos",
    "Suporte prioritário"
  ]'::jsonb
WHERE slug = 'pro';

-- 3. Atualizar Agência: Perfis Ativos Ilimitados (-1)
UPDATE public.plans
SET 
  limits = jsonb_set(
    jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_profiles}', '-1'::jsonb, true),
    '{max_channels}', '-1'::jsonb, true
  ),
  features = '[
    "Perfis Ativos ilimitados",
    "Múltiplas contas Zernio integradas",
    "Automação com IA com todas as LLMs",
    "Personalização White Label completa",
    "Acesso prioritário a novos recursos",
    "Gerente de conta dedicado"
  ]'::jsonb
WHERE slug = 'agency';
