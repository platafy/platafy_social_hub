-- ==============================================================================
-- MIGRATION: 20260720000000_security_and_performance_hardening.sql
-- AUDITORIA PROFUNDA DE SEGURANÇA, ISOLAMENTO MULTI-TENANT E BANCO DE DADOS
-- PLATAFY SOCIAL HUB
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

-- 2. AJUSTES DE PERMISSÕES NA TABELA TENANTS
GRANT SELECT, UPDATE ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;

-- 3. REVOGAÇÃO COMPLETA DE ACESSOS ANÔNIMOS EM TABELAS SENSÍVEIS
REVOKE ALL ON public.zernio_contacts FROM anon;
REVOKE ALL ON public.zernio_automation_logs FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.plans FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.payment_history FROM anon;
REVOKE ALL ON public.platform_settings FROM anon;

-- 4. BLINDAGEM DE RLS NA TABELA zernio_contacts (DADOS PESSOAIS / CRM)
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

-- 5. BLINDAGEM DE RLS NA TABELA zernio_automation_logs
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

-- Adicionar coluna rule_id faltante se não existir
ALTER TABLE public.zernio_automation_logs
  ADD COLUMN IF NOT EXISTS rule_id UUID REFERENCES public.zernio_automations(id) ON DELETE SET NULL;

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

-- 6. BLINDAGEM DE RLS NA TABELA plans (PREVENÇÃO DE MANIPULAÇÃO DE PREÇOS)
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

-- 7. BLINDAGEM DE RLS NA TABELA subscriptions (CLIENTES NÃO PODEM SE AUTO-PROMOVER)
-- Remove a permissão de UPDATE de usuários autenticados comuns
DROP POLICY IF EXISTS "Subscriptions tenant update" ON public.subscriptions;
DROP POLICY IF EXISTS "Superadmin subscriptions update" ON public.subscriptions;
DROP POLICY IF EXISTS "Superadmin subscriptions insert" ON public.subscriptions;
REVOKE UPDATE, INSERT, DELETE ON public.subscriptions FROM authenticated;

-- Apenas o Super Admin ou service_role (webhook de pagamento) podem alterar assinaturas
CREATE POLICY "Superadmin subscriptions update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Superadmin subscriptions insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 8. VISIBILIDADE DO SUPER ADMIN NAS INTEGRAÇÕES E CANAIS DE CLIENTES
DROP POLICY IF EXISTS "Superadmin integrations select" ON public.zernio_integrations;
CREATE POLICY "Superadmin integrations select" ON public.zernio_integrations
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin channels select" ON public.zernio_integration_channels;
CREATE POLICY "Superadmin channels select" ON public.zernio_integration_channels
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

-- 9. BLINDAGEM COMPLETA DO STORAGE (storage.objects)
-- Revogar permissões perigosas de anon nos buckets de mídia
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

-- 10. INTEGRIDADE REFERENCIAL DE DEDUP
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

-- 11. ÍNDICES DE ALTA PERFORMANCE (ELIMINANDO FULL TABLE SCANS)
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
