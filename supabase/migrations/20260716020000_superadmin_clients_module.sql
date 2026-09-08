-- ========================================================
-- MIGRATION: SUPER ADMIN CLIENTS & LICENSES MANAGEMENT
-- ========================================================

-- 1. Função auxiliar para validar Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (auth.jwt() ->> 'email' = 'suporte@platafy.com');
$$;

-- 2. Evolução da tabela de Assinaturas (Subscriptions)
ALTER TABLE public.subscriptions 
  ADD COLUMN IF NOT EXISTS billing_type TEXT NOT NULL DEFAULT 'mercadopago',
  ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'credit_card',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS last_payment_date TIMESTAMPTZ;

-- 3. Evolução da tabela de Perfis (Profiles)
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- 4. Atualizar trigger handle_new_user para salvar phone se fornecido
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
  phone_num TEXT;
  pro_plan_id UUID;
BEGIN
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1) || '''s workspace');
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  phone_num := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  INSERT INTO public.tenants (name) VALUES (tenant_name) RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name, phone)
  VALUES (NEW.id, new_tenant_id, NEW.email, full_name, phone_num);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  -- Obter plano pro para associar ao trial
  SELECT id INTO pro_plan_id FROM public.plans WHERE slug = 'pro' LIMIT 1;

  -- Criar assinatura com 7 dias de teste gratuito
  INSERT INTO public.subscriptions (tenant_id, plan_id, status, trial_ends_at, billing_type)
  VALUES (new_tenant_id, pro_plan_id, 'trialing', now() + interval '7 days', 'mercadopago')
  ON CONFLICT (tenant_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 5. Tabela de Auditoria Administrativa (Admin Audit Logs)
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_email TEXT NOT NULL,
  target_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'client_created', 'plan_changed', 'license_status_changed', 'license_renewed', 'notes_updated', 'client_deleted'
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON public.admin_audit_logs(target_tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.admin_audit_logs(created_at DESC);

GRANT SELECT, INSERT ON public.admin_audit_logs TO authenticated;
GRANT ALL ON public.admin_audit_logs TO service_role;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin audit logs select" ON public.admin_audit_logs;
CREATE POLICY "Superadmin audit logs select" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin audit logs insert" ON public.admin_audit_logs;
CREATE POLICY "Superadmin audit logs insert" ON public.admin_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- 6. RLS Policies: Permitir acesso total do Super Admin às tabelas centrais

-- Subscriptions
DROP POLICY IF EXISTS "Superadmin subscriptions select" ON public.subscriptions;
CREATE POLICY "Superadmin subscriptions select" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin subscriptions update" ON public.subscriptions;
CREATE POLICY "Superadmin subscriptions update" ON public.subscriptions
  FOR UPDATE TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin subscriptions insert" ON public.subscriptions;
CREATE POLICY "Superadmin subscriptions insert" ON public.subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Tenants
DROP POLICY IF EXISTS "Superadmin tenants select" ON public.tenants;
CREATE POLICY "Superadmin tenants select" ON public.tenants
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin tenants update" ON public.tenants;
CREATE POLICY "Superadmin tenants update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- Profiles
DROP POLICY IF EXISTS "Superadmin profiles select" ON public.profiles;
CREATE POLICY "Superadmin profiles select" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin profiles update" ON public.profiles;
CREATE POLICY "Superadmin profiles update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

-- Payment History
DROP POLICY IF EXISTS "Superadmin payment_history select" ON public.payment_history;
CREATE POLICY "Superadmin payment_history select" ON public.payment_history
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

DROP POLICY IF EXISTS "Superadmin payment_history insert" ON public.payment_history;
CREATE POLICY "Superadmin payment_history insert" ON public.payment_history
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

-- Plans
DROP POLICY IF EXISTS "Superadmin plans select" ON public.plans;
CREATE POLICY "Superadmin plans select" ON public.plans
  FOR SELECT TO authenticated
  USING (public.is_super_admin());
