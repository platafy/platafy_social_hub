-- Migrations for Zernio API Integration and Cache tables

-- Table to store Zernio Integration Keys per Tenant
CREATE TABLE IF NOT EXISTS public.zernio_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  api_key TEXT NOT NULL,
  zernio_profile_id TEXT, -- Profiles mapped on Zernio side
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id)
);

-- RLS policies for zernio_integrations
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_integrations TO authenticated;
GRANT ALL ON public.zernio_integrations TO service_role;
ALTER TABLE public.zernio_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Integrations tenant select" ON public.zernio_integrations
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Integrations tenant insert" ON public.zernio_integrations
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Integrations tenant update" ON public.zernio_integrations
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Integrations tenant delete" ON public.zernio_integrations
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'admin'));


-- Cache / Sync table for local tracking of posts
CREATE TABLE IF NOT EXISTS public.zernio_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  zernio_post_id TEXT UNIQUE,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TIMESTAMPTZ,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  platforms JSONB,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies for zernio_posts
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_posts TO authenticated;
GRANT ALL ON public.zernio_posts TO service_role;
ALTER TABLE public.zernio_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Posts tenant select" ON public.zernio_posts
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Posts tenant insert" ON public.zernio_posts
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Posts tenant update" ON public.zernio_posts
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Posts tenant delete" ON public.zernio_posts
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Set up triggers for updated_at column updates
CREATE TRIGGER update_zernio_integrations_updated_at
  BEFORE UPDATE ON public.zernio_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zernio_posts_updated_at
  BEFORE UPDATE ON public.zernio_posts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
