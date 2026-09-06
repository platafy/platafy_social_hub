-- Migration to support multiple Zernio API Keys/Accounts per Tenant and Channel Mapping

-- 1. Remove the unique constraint on tenant_id for zernio_integrations to allow multiple integrations
ALTER TABLE public.zernio_integrations DROP CONSTRAINT IF EXISTS zernio_integrations_tenant_id_key;

-- 2. Add name/label column to identify each configuration
ALTER TABLE public.zernio_integrations ADD COLUMN IF NOT EXISTS name TEXT DEFAULT 'Conta Principal';

-- 3. Add link to zernio_posts to know which key/profile posted it
ALTER TABLE public.zernio_posts ADD COLUMN IF NOT EXISTS zernio_integration_id UUID REFERENCES public.zernio_integrations(id) ON DELETE SET NULL;

-- 4. Create channels mapping table
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

-- RLS policies for zernio_integration_channels
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_integration_channels TO authenticated;
GRANT ALL ON public.zernio_integration_channels TO service_role;
ALTER TABLE public.zernio_integration_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Channels tenant select" ON public.zernio_integration_channels
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Channels tenant insert" ON public.zernio_integration_channels
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Channels tenant update" ON public.zernio_integration_channels
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Channels tenant delete" ON public.zernio_integration_channels
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));
