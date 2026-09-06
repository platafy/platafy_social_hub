-- Migration to add Automation Logs table
CREATE TABLE IF NOT EXISTS public.zernio_automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  social_account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  sender_username TEXT,
  content TEXT,
  status TEXT NOT NULL DEFAULT 'no_automation', -- 'success', 'failed', 'ignored', 'no_automation'
  error_message TEXT,
  reply_sent TEXT,
  raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_automation_logs TO authenticated, anon;
GRANT ALL ON public.zernio_automation_logs TO service_role;
ALTER TABLE public.zernio_automation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Logs tenant select authenticated" ON public.zernio_automation_logs
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Logs tenant select anon" ON public.zernio_automation_logs
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Logs tenant insert authenticated" ON public.zernio_automation_logs
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Logs tenant insert anon" ON public.zernio_automation_logs
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Logs tenant update authenticated" ON public.zernio_automation_logs
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Logs tenant update anon" ON public.zernio_automation_logs
    FOR UPDATE TO anon
    USING (true);

CREATE POLICY "Logs tenant delete authenticated" ON public.zernio_automation_logs
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));
