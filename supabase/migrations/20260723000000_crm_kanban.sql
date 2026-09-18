-- Migration: CRM Kanban - Etapas do Funil, Tags e Controles de Automação

-- 1. Tabela de Colunas/Etapas do Funil Kanban
CREATE TABLE IF NOT EXISTS public.crm_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#758fff',
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Tabela de Tags do CRM
CREATE TABLE IF NOT EXISTS public.crm_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#04d25d',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Atualizar tabela zernio_contacts com campos de CRM
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'zernio_contacts' AND column_name = 'crm_column_id'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD COLUMN crm_column_id UUID REFERENCES public.crm_columns(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'zernio_contacts' AND column_name = 'is_automation_enabled'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD COLUMN is_automation_enabled BOOLEAN NOT NULL DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'zernio_contacts' AND column_name = 'notes'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD COLUMN notes TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'zernio_contacts' AND column_name = 'username'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD COLUMN username TEXT DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'zernio_contacts' AND column_name = 'follower_count'
  ) THEN
    ALTER TABLE public.zernio_contacts 
      ADD COLUMN follower_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- 4. Índices de Performance
CREATE INDEX IF NOT EXISTS idx_crm_columns_tenant ON public.crm_columns(tenant_id, order_index);
CREATE INDEX IF NOT EXISTS idx_crm_tags_tenant ON public.crm_tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_zernio_contacts_crm_col ON public.zernio_contacts(tenant_id, crm_column_id);

-- 5. RLS: crm_columns
ALTER TABLE public.crm_columns ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_columns TO authenticated;
GRANT ALL ON public.crm_columns TO service_role;

DROP POLICY IF EXISTS "CRM columns tenant select" ON public.crm_columns;
CREATE POLICY "CRM columns tenant select" ON public.crm_columns
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM columns tenant insert" ON public.crm_columns;
CREATE POLICY "CRM columns tenant insert" ON public.crm_columns
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM columns tenant update" ON public.crm_columns;
CREATE POLICY "CRM columns tenant update" ON public.crm_columns
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM columns tenant delete" ON public.crm_columns;
CREATE POLICY "CRM columns tenant delete" ON public.crm_columns
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM columns superadmin select" ON public.crm_columns;
CREATE POLICY "CRM columns superadmin select" ON public.crm_columns
  FOR ALL TO authenticated
  USING (public.is_super_admin());

-- 6. RLS: crm_tags
ALTER TABLE public.crm_tags ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_tags TO authenticated;
GRANT ALL ON public.crm_tags TO service_role;

DROP POLICY IF EXISTS "CRM tags tenant select" ON public.crm_tags;
CREATE POLICY "CRM tags tenant select" ON public.crm_tags
  FOR SELECT TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM tags tenant insert" ON public.crm_tags;
CREATE POLICY "CRM tags tenant insert" ON public.crm_tags
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM tags tenant update" ON public.crm_tags;
CREATE POLICY "CRM tags tenant update" ON public.crm_tags
  FOR UPDATE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()))
  WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM tags tenant delete" ON public.crm_tags;
CREATE POLICY "CRM tags tenant delete" ON public.crm_tags
  FOR DELETE TO authenticated
  USING (tenant_id = public.get_user_tenant(auth.uid()));

DROP POLICY IF EXISTS "CRM tags superadmin select" ON public.crm_tags;
CREATE POLICY "CRM tags superadmin select" ON public.crm_tags
  FOR ALL TO authenticated
  USING (public.is_super_admin());

-- 7. Função para Auto-Seed das Colunas Padrão do Funil
CREATE OR REPLACE FUNCTION public.seed_default_crm_columns(p_tenant_id UUID)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.crm_columns WHERE tenant_id = p_tenant_id) THEN
    INSERT INTO public.crm_columns (tenant_id, name, color, order_index, is_active) VALUES
      (p_tenant_id, 'Leads', '#758fff', 0, true),
      (p_tenant_id, 'Atendimento', '#3b82f6', 1, true),
      (p_tenant_id, 'Comercial', '#10b981', 2, true),
      (p_tenant_id, 'Suporte', '#eab308', 3, true),
      (p_tenant_id, 'Agendamento', '#06b6d4', 4, true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.crm_tags WHERE tenant_id = p_tenant_id) THEN
    INSERT INTO public.crm_tags (tenant_id, name, color, is_active) VALUES
      (p_tenant_id, 'Lead Quente', '#ef4444', true),
      (p_tenant_id, 'Cliente VIP', '#a855f7', true),
      (p_tenant_id, 'DirectFlow', '#3b82f6', true),
      (p_tenant_id, 'Negociação', '#f59e0b', true),
      (p_tenant_id, 'Fechado', '#10b981', true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Executar auto-seed para todos os tenants já existentes
DO $$
DECLARE
  t RECORD;
BEGIN
  FOR t IN SELECT id FROM public.tenants LOOP
    PERFORM public.seed_default_crm_columns(t.id);
  END LOOP;
END $$;

-- 9. Trigger para atribuir novos contatos automaticamente à coluna "Leads" do tenant
CREATE OR REPLACE FUNCTION public.set_default_crm_column()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.crm_column_id IS NULL THEN
    SELECT id INTO NEW.crm_column_id 
    FROM public.crm_columns 
    WHERE tenant_id = NEW.tenant_id AND is_active = true 
    ORDER BY order_index ASC 
    LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_set_default_crm_column ON public.zernio_contacts;
CREATE TRIGGER trigger_set_default_crm_column
  BEFORE INSERT ON public.zernio_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_crm_column();

