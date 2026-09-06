-- Migration to add Automations table
CREATE TABLE IF NOT EXISTS public.zernio_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  social_account_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  trigger_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'keyword'
  keywords TEXT[] DEFAULT '{}',
  automation_type TEXT NOT NULL DEFAULT 'comment_reply', -- 'comment_reply', 'dm_reply', 'comment_to_dm'
  ai_provider TEXT NOT NULL DEFAULT 'static', -- 'static', 'gemini', 'openai', 'anthropic'
  ai_prompt TEXT,
  static_reply TEXT,
  target_posts_type TEXT NOT NULL DEFAULT 'all', -- 'all', 'specific'
  target_post_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, social_account_id, automation_type)
);

-- RLS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_automations TO authenticated;
GRANT ALL ON public.zernio_automations TO service_role;
ALTER TABLE public.zernio_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Automations tenant select" ON public.zernio_automations
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Automations tenant insert" ON public.zernio_automations
    FOR INSERT TO authenticated
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Automations tenant update" ON public.zernio_automations
    FOR UPDATE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()))
    WITH CHECK (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Automations tenant delete" ON public.zernio_automations
    FOR DELETE TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_zernio_automations_updated_at
  BEFORE UPDATE ON public.zernio_automations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
