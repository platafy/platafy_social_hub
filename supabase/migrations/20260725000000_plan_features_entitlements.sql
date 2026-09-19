-- Migration: Permissões e Limites de Funcionalidades por Plano
-- Data: 2026-07-25

-- 1. Atualizar Plano Starter: 1 Perfil (até 2 contas sociais), automação básica em posts orgânicos
UPDATE public.plans
SET 
  limits = jsonb_build_object(
    'max_profiles', 1,
    'max_channels', 2,
    'max_posts', 50,
    'max_contacts', 100,
    'ai_automations', false,
    'ads_automations', false,
    'stories_automations', false,
    'auto_moderation', false,
    'auto_engagement', false,
    'auto_pin', false,
    'tiktok_channel', false,
    'white_label', false
  ),
  features = '[
    "1 Perfil Ativo (até 2 contas sociais)",
    "50 posts agendados por mês",
    "Inbox e DMs unificados",
    "Automação básica (comentários e DMs orgânicas)",
    "Gestão de até 100 contatos no CRM",
    "Suporte por e-mail"
  ]'::jsonb
WHERE slug = 'starter';

-- 2. Atualizar Plano Pro: 5 Perfis (até 10 contas), Meta Ads, Stories, Moderação IA, TikTok e CRM
UPDATE public.plans
SET 
  limits = jsonb_build_object(
    'max_profiles', 5,
    'max_channels', 10,
    'max_posts', -1,
    'max_contacts', 1000,
    'ai_automations', true,
    'ads_automations', true,
    'stories_automations', true,
    'auto_moderation', true,
    'auto_engagement', true,
    'auto_pin', true,
    'tiktok_channel', true,
    'white_label', false
  ),
  features = '[
    "Até 5 Perfis Ativos (até 10 contas sociais)",
    "Publicações e agendamentos ilimitados",
    "Automação em Anúncios Pagos (Meta Ads / Dark Posts)",
    "Gatilhos de Stories (Menções e Respostas no Instagram)",
    "Automação com IA (Gemini, OpenAI, Claude)",
    "Auto-Engajamento (Auto-Like & Coração YouTube)",
    "Moderação inteligente anti-spam com IA",
    "Fixação automática de comentários (Auto-Pin)",
    "Canal TikTok incluso (Publicação e Comentários)",
    "CRM Kanban de Leads & Transbordo",
    "Suporte prioritário"
  ]'::jsonb
WHERE slug = 'pro';

-- 3. Atualizar Plano Agência: Tudo ilimitado, White Label completo e suporte VIP
UPDATE public.plans
SET 
  limits = jsonb_build_object(
    'max_profiles', -1,
    'max_channels', -1,
    'max_posts', -1,
    'max_contacts', -1,
    'ai_automations', true,
    'ads_automations', true,
    'stories_automations', true,
    'auto_moderation', true,
    'auto_engagement', true,
    'auto_pin', true,
    'tiktok_channel', true,
    'white_label', true
  ),
  features = '[
    "Perfis Ativos ilimitados",
    "Contas sociais e agendamentos ilimitados",
    "Todas as automações avançadas (Meta Ads, Stories, IA)",
    "Auto-Engajamento, Moderação e Auto-Pin ilimitados",
    "Suporte completo ao TikTok e todas as redes",
    "CRM Kanban sem limite de contatos",
    "Personalização White Label completa (SaaS próprio)",
    "Múltiplas integrações Zernio",
    "Gerente de conta dedicado e suporte VIP"
  ]'::jsonb
WHERE slug = 'agency';
