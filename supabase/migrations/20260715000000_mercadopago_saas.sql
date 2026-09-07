-- ========================================================
-- MIGRATION: MERCADO PAGO SAAS SUBSCRIPTIONS & PLANS
-- ========================================================

-- 1. Tabela de Planos (Plans)
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  interval TEXT NOT NULL DEFAULT 'monthly',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  limits JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_popular BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans are viewable by authenticated users" ON public.plans;
DROP POLICY IF EXISTS "Plans are viewable by everyone" ON public.plans;
CREATE POLICY "Plans are viewable by everyone" ON public.plans
  FOR SELECT USING (is_active = true);

-- Inserir os 3 Planos Padrão do SaaS
INSERT INTO public.plans (name, slug, description, price, features, limits, is_popular)
VALUES 
  (
    'Starter', 
    'starter', 
    'Perfeito para autônomos e pequenos criadores de conteúdo', 
    47.00, 
    '["Até 3 redes sociais conectadas", "50 posts agendados por mês", "Inbox e DMs unificados", "Gestão de até 100 contatos", "Suporte por e-mail"]'::jsonb,
    '{"max_channels": 3, "max_posts": 50, "max_contacts": 100, "ai_automations": false}'::jsonb,
    false
  ),
  (
    'Pro', 
    'pro', 
    'O mais recomendado para empresas, profissionais e criadores em crescimento', 
    97.00, 
    '["Até 10 redes sociais conectadas", "Publicações e agendamentos ilimitados", "Automação com IA (Gemini, OpenAI, Claude)", "Moderação inteligente de comentários", "CRM completo de contatos", "Suporte prioritário"]'::jsonb,
    '{"max_channels": 10, "max_posts": -1, "max_contacts": 1000, "ai_automations": true}'::jsonb,
    true
  ),
  (
    'Agência', 
    'agency', 
    'Para agências e negócios que gerenciam múltiplas marcas e clientes', 
    197.00, 
    '["Redes sociais ilimitadas", "Múltiplas contas Zernio integradas", "Automação com IA com todas as LLMs", "Personalização White Label completa", "Acesso prioritário a novos recursos", "Gerente de conta dedicado"]'::jsonb,
    '{"max_channels": -1, "max_posts": -1, "max_contacts": -1, "ai_automations": true, "white_label": true}'::jsonb,
    false
  )
ON CONFLICT (slug) DO NOTHING;

-- 2. Tabela de Assinaturas (Subscriptions)
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'trialing', -- trialing, active, past_due, canceled
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  mercadopago_preapproval_id TEXT,
  mercadopago_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

GRANT SELECT, INSERT, UPDATE ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Subscriptions tenant select" ON public.subscriptions;
CREATE POLICY "Subscriptions tenant select" ON public.subscriptions
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "Subscriptions tenant update" ON public.subscriptions;
CREATE POLICY "Subscriptions tenant update" ON public.subscriptions
  FOR UPDATE TO authenticated 
  USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

-- 3. Histórico de Pagamentos (Payment History)
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_method TEXT,
  status TEXT NOT NULL, -- approved, pending, rejected
  mercadopago_payment_id TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.payment_history TO authenticated;
GRANT ALL ON public.payment_history TO service_role;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payment history tenant select" ON public.payment_history;
CREATE POLICY "Payment history tenant select" ON public.payment_history
  FOR SELECT TO authenticated USING (tenant_id = public.get_user_tenant(auth.uid()));

-- 4. Configurações da Plataforma (Platform Settings / Mercado Pago)
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mercadopago_access_token TEXT DEFAULT '',
  mercadopago_public_key TEXT DEFAULT '',
  mercadopago_webhook_secret TEXT DEFAULT '',
  trial_days INTEGER DEFAULT 7,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform settings admin select" ON public.platform_settings;
CREATE POLICY "Platform settings admin select" ON public.platform_settings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Platform settings admin update" ON public.platform_settings;
CREATE POLICY "Platform settings admin update" ON public.platform_settings
  FOR UPDATE TO authenticated 
  USING (public.has_role(auth.uid(), 'admin'));

-- Inserir linha única de configurações se não existir
INSERT INTO public.platform_settings (mercadopago_access_token, trial_days)
SELECT '', 7
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- 5. Inicializar assinaturas dos tenants existentes (Platafy) com acesso Ativo
INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at, current_period_end)
SELECT 
  t.id,
  (SELECT id FROM public.plans WHERE slug = 'agency' LIMIT 1),
  'active',
  now() + interval '365 days',
  now() + interval '365 days'
FROM public.tenants t
ON CONFLICT (tenant_id) DO NOTHING;

-- 6. Atualizar Trigger de novo usuário para já conceder 7 dias de Trial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_tenant_id UUID;
  tenant_name TEXT;
  full_name TEXT;
  pro_plan_id UUID;
BEGIN
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1) || '''s workspace');
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.tenants (name) VALUES (tenant_name) RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name)
  VALUES (NEW.id, new_tenant_id, NEW.email, full_name);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  -- Obter plano pro para associar ao trial
  SELECT id INTO pro_plan_id FROM public.plans WHERE slug = 'pro' LIMIT 1;

  -- Criar assinatura com 7 dias de teste gratuito
  INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at)
  VALUES (new_tenant_id, pro_plan_id, 'trialing', now() + interval '7 days')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;
