-- ==============================================================================
-- MIGRATION: 20260720000000_security_and_performance_hardening.sql
-- AUDITORIA PROFUNDA DE SEGURANÇA, ISOLAMENTO MULTI-TENANT E BANCO DE DADOS
-- PLATAFY SOCIAL HUB (VERSÃO TOTALMENTE AUTOCONTIDA E RESILIENTE)
-- ==============================================================================

-- 1. HARDENING DA FUNÇÃO DE SUPER ADMIN (Case-insensitive e sanitizada)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (LOWER(COALESCE(auth.jwt() ->> 'email', '')) = 'suporte@platafy.com');
$$;

-- 2. GARANTIR ESTRUTURAS E COLUNAS DE TODAS AS TABELAS DO SISTEMA
-- Garante que zernio_integrations possui todas as colunas necessárias
ALTER TABLE public.zernio_integrations 
  ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Conta Principal',
  ADD COLUMN IF NOT EXISTS account_name TEXT,
  ADD COLUMN IF NOT EXISTS zernio_profile_id TEXT,
  ADD COLUMN IF NOT EXISTS ai_gemini_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_openai_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_anthropic_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_mistral_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_groq_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_seekai_key TEXT;

-- Garante que zernio_posts possui zernio_integration_id
ALTER TABLE public.zernio_posts 
  ADD COLUMN IF NOT EXISTS zernio_integration_id UUID REFERENCES public.zernio_integrations(id) ON DELETE SET NULL;

-- Garante que a tabela zernio_integration_channels existe
CREATE TABLE IF NOT EXISTS public.zernio_integration_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES public.zernio_integrations(id) ON DELETE CASCADE,
  social_account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  name TEXT,
  username TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, social_account_id)
);

-- Garante que a tabela zernio_automations existe
CREATE TABLE IF NOT EXISTS public.zernio_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  social_account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL DEFAULT 'all',
  keywords TEXT[] DEFAULT '{}',
  automation_type TEXT NOT NULL DEFAULT 'comment_reply',
  ai_provider TEXT NOT NULL DEFAULT 'static',
  ai_prompt TEXT,
  static_reply TEXT,
  target_posts_type TEXT NOT NULL DEFAULT 'all',
  target_post_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, social_account_id, automation_type)
);

-- Garante que a tabela zernio_automation_dedup existe
CREATE TABLE IF NOT EXISTS public.zernio_automation_dedup (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  comment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, event_id)
);

-- Garante que a tabela zernio_automation_logs existe e possui rule_id
CREATE TABLE IF NOT EXISTS public.zernio_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  social_account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sender_username TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'no_automation',
  error_message TEXT,
  reply_sent TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zernio_automation_logs
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.zernio_automations(id) ON DELETE SET NULL;

-- Garante que a tabela zernio_contacts existe
CREATE TABLE IF NOT EXISTS public.zernio_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  zernio_contact_id TEXT NOT NULL,
  profile_id TEXT,
  integration_id TEXT,
  name TEXT,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  tags TEXT[] DEFAULT '{}',
  platforms TEXT[] DEFAULT '{}',
  last_interaction_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (tenant_id, zernio_contact_id)
);

-- Garante que subscriptions possui colunas de gestão manual
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'credit_card',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- Garante que payment_history existe
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'BRL',
  payment_method TEXT,
  status TEXT NOT NULL,
  mercadopago_payment_id TEXT,
  receipt_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. AJUSTES DE PERMISSÕES NA TABELA TENANTS
GRANT SELECT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

-- 4. REVOGAÇÃO COMPLETA DE ACESSOS ANÔNIMOS EM TABELAS SENSÍVEIS
REVOKE ALL ON public.zernio_contacts FROM anon;
REVOKE ALL ON public.zernio_automation_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM anon;
REVOKE ALL ON public.platform_settings FROM anon;

-- 5. BLINDAGEM DE RLS NA TABELA zernio_contacts (DADOS PESSOAIS / CRM)
DROP POLICY IF EXISTS "tenant_access" ON public.zernio_contacts;
DROP POLICY IF EXISTS "anon_access" ON public.zernio_contacts;
DROP POLICY IF EXISTS "Contacts tenant select" ON public.zernio_contacts;
DROP POLICY IF EXISTS "Contacts tenant insert" ON public.zernio_contacts;
DROP POLICY IF EXISTS "Contacts tenant update" ON public.zernio_contacts;
DROP POLICY IF EXISTS "Contacts tenant delete" ON public.zernio_contacts;
DROP POLICY IF EXISTS "Contacts superadmin select" ON public.zernio_contacts;

-- Garantir Foreign Key cascade em zernio_contacts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'zernio_contacts_tenant_id_fkey' 
    AND table_name = 'zernio_contacts'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD CONSTRAINT zernio_contacts_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

ALTER TABLE public.zernio_contacts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_contacts TO authenticated;
GRANT ALL ON public.zernio_contacts TO service_role;

CREATE POLICY "Contacts tenant select" ON public.zernio_contacts
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Contacts tenant insert" ON public.zernio_contacts
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Contacts tenant update" ON public.zernio_contacts
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Contacts tenant delete" ON public.zernio_contacts
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Contacts superadmin select" ON public.zernio_contacts
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 6. BLINDAGEM DE RLS NA TABELA zernio_automation_logs
DROP POLICY IF EXISTS "Logs tenant select anon" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant insert anon" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant update anon" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant select anon_v2" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant insert anon_v2" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant update anon_v2" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant select authenticated" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant insert authenticated" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant update authenticated" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant delete authenticated" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant select" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs tenant delete" ON public.zernio_automation_logs;
DROP POLICY IF EXISTS "Logs superadmin select" ON public.zernio_automation_logs;

ALTER TABLE public.zernio_automation_logs ENABLE ROW LEVEL SECURITY;
GRANT SELECT, DELETE ON public.zernio_automation_logs TO authenticated;
GRANT ALL ON public.zernio_automation_logs TO service_role;

CREATE POLICY "Logs tenant select" ON public.zernio_automation_logs
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Logs tenant delete" ON public.zernio_automation_logs
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Logs superadmin select" ON public.zernio_automation_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 7. BLINDAGEM DE RLS NA TABELA plans (PREVENÇÃO DE MANIPULAÇÃO DE PREÇOS)
DROP POLICY IF EXISTS "Superadmin plans update" ON public.plans;
DROP POLICY IF EXISTS "Superadmin plans insert" ON public.plans;
DROP POLICY IF EXISTS "Superadmin plans delete" ON public.plans;

GRANT SELECT ON public.plans TO anon, authenticated;
GRANT ALL ON public.plans TO service_role;

CREATE POLICY "Superadmin plans update" ON public.plans
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin plans insert" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin plans delete" ON public.plans
  FOR DELETE TO authenticated
  USING (public.is_super_admin());

-- 8. BLINDAGEM DE RLS NA TABELA subscriptions (CLIENTES NÃO PODEM SE AUTO-PROMOVER)
DROP POLICY IF EXISTS "Subscriptions tenant update" ON public.subscriptions;
DROP POLICY IF EXISTS "Superadmin subscriptions update" ON public.subscriptions;
DROP POLICY IF EXISTS "Superadmin subscriptions insert" ON public.subscriptions;
REVOKE UPDATE, INSERT, DELETE ON public.subscriptions FROM authenticated;

CREATE POLICY "Superadmin subscriptions update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin subscriptions insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 9. VISIBILIDADE DO SUPER ADMIN NAS INTEGRAÇÕES E CANAIS DE CLIENTES
DROP POLICY IF EXISTS "Superadmin integrations select" ON public.zernio_integrations;
CREATE POLICY "Superadmin integrations select" ON public.zernio_integrations
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin channels select" ON public.zernio_integration_channels;
CREATE POLICY "Superadmin channels select" ON public.zernio_integration_channels
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 10. BLINDAGEM COMPLETA DO STORAGE (storage.objects)
DROP POLICY IF EXISTS "Allow Insert on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Insert on media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Update on media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete on media" ON storage.objects;

DROP POLICY IF EXISTS "Public Read on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access on zernio-media" ON storage.objects;
CREATE POLICY "Public Read Access on zernio-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Public Read on media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access on media" ON storage.objects;
CREATE POLICY "Public Read Access on media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

-- Inserção, Atualização e Deleção estritamente para usuários autenticados
DROP POLICY IF EXISTS "Authenticated Insert on zernio-media" ON storage.objects;
CREATE POLICY "Authenticated Insert on zernio-media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Update on zernio-media" ON storage.objects;
CREATE POLICY "Authenticated Update on zernio-media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Delete on zernio-media" ON storage.objects;
CREATE POLICY "Authenticated Delete on zernio-media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Insert on media" ON storage.objects;
CREATE POLICY "Authenticated Insert on media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated Update on media" ON storage.objects;
CREATE POLICY "Authenticated Update on media" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated Delete on media" ON storage.objects;
CREATE POLICY "Authenticated Delete on media" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'media');

-- 11. INTEGRIDADE REFERENCIAL DE DEDUP
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'zernio_automation_dedup_tenant_id_fkey' 
    AND table_name = 'zernio_automation_dedup'
  ) THEN
    ALTER TABLE public.zernio_automation_dedup 
      ADD CONSTRAINT zernio_automation_dedup_tenant_id_fkey 
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 12. ÍNDICES DE ALTA PERFORMANCE (ELIMINANDO FULL TABLE SCANS)
CREATE INDEX IF NOT EXISTS idx_zernio_integrations_tenant ON public.zernio_integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zernio_posts_tenant ON public.zernio_posts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zernio_posts_integration ON public.zernio_posts(zernio_integration_id);
CREATE INDEX IF NOT EXISTS idx_zernio_posts_created_by ON public.zernio_posts(created_by);
CREATE INDEX IF NOT EXISTS idx_zernio_posts_scheduled ON public.zernio_posts(tenant_id, scheduled_at, status);
CREATE INDEX IF NOT EXISTS idx_zernio_channels_integration ON public.zernio_integration_channels(integration_id);
CREATE INDEX IF NOT EXISTS idx_zernio_channels_social_acc ON public.zernio_integration_channels(social_account_id);
CREATE INDEX IF NOT EXISTS idx_zernio_automations_social_acc ON public.zernio_automations(social_account_id);
CREATE INDEX IF NOT EXISTS idx_zernio_automations_sync ON public.zernio_automations(platform, is_enabled);
CREATE INDEX IF NOT EXISTS idx_zernio_logs_tenant_created ON public.zernio_automation_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_zernio_logs_external_status ON public.zernio_automation_logs(external_id, status);
CREATE INDEX IF NOT EXISTS idx_zernio_logs_social_acc ON public.zernio_automation_logs(social_account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON public.subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_tenant ON public.payment_history(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_plan ON public.payment_history(plan_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_created ON public.payment_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_roles_tenant ON public.user_roles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_automation_dedup_tenant ON public.zernio_automation_dedup(tenant_id);
