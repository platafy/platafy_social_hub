-- ==============================================================================
-- MIGRATION: Configuração do Período de Teste Gratuito no Plano Starter (R$ 37,00)
-- 1. Atualiza o preço do plano Starter para R$ 37,00
-- 2. Atualiza a trigger handle_new_user para associar ao plano Starter e ler trial_days dinamicamente
-- 3. Cria função pública segura get_public_trial_days para a tela de cadastro
-- ==============================================================================

-- 1. Atualizar o preço do plano Starter para R$ 37,00
UPDATE public.plans
SET price = 37.00
WHERE slug = 'starter';

-- 2. Função pública segura para consultar os dias de teste sem expor credenciais do Mercado Pago
CREATE OR REPLACE FUNCTION public.get_public_trial_days()
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(trial_days, 7) FROM public.platform_settings LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_trial_days() TO anon, authenticated;

-- 3. Atualizar a trigger handle_new_user()
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
  starter_plan_id UUID;
  configured_trial_days INTEGER;
  calculated_trial_end TIMESTAMPTZ;
BEGIN
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1) || '''s workspace');
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  phone_num := COALESCE(NEW.raw_user_meta_data->>'phone', '');

  -- 1. Criar Workspace (Tenant)
  INSERT INTO public.tenants (name) VALUES (tenant_name) RETURNING id INTO new_tenant_id;

  -- 2. Criar Perfil
  INSERT INTO public.profiles (id, tenant_id, email, full_name, phone)
  VALUES (NEW.id, new_tenant_id, NEW.email, full_name, phone_num);

  -- 3. Criar Permissão de Administrador no Workspace
  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  -- 4. Obter o ID do plano Starter (R$ 37,00) para o período de teste
  SELECT id INTO starter_plan_id FROM public.plans WHERE slug = 'starter' LIMIT 1;
  IF starter_plan_id IS NULL THEN
    SELECT id INTO starter_plan_id FROM public.plans ORDER BY price ASC LIMIT 1;
  END IF;

  -- 5. Obter a quantidade de dias de teste configurada pelo Super Admin em platform_settings (padrão: 7 dias)
  SELECT COALESCE(trial_days, 7) INTO configured_trial_days FROM public.platform_settings LIMIT 1;
  IF configured_trial_days IS NULL THEN
    configured_trial_days := 7;
  END IF;

  calculated_trial_end := now() + (configured_trial_days || ' days')::interval;

  -- 6. Criar assinatura inicial no plano Starter em período de teste gratuito
  INSERT INTO public.subscriptions (
    tenant_id,
    plan_id,
    status,
    trial_ends_at,
    billing_type,
    payment_method,
    notes
  )
  VALUES (
    new_tenant_id,
    starter_plan_id,
    'trialing',
    calculated_trial_end,
    'mercadopago',
    'trial',
    'Período de teste gratuito (' || configured_trial_days || ' dias) no plano Starter'
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    plan_id = EXCLUDED.plan_id,
    status = EXCLUDED.status,
    trial_ends_at = EXCLUDED.trial_ends_at;

  RETURN NEW;
END;
$$;
