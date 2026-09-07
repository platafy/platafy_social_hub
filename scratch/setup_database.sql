-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tenants TO authenticated;
GRANT ALL ON public.tenants TO service_role;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_profiles_tenant ON public.profiles(tenant_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Roles enum & table
CREATE TYPE public.app_role AS ENUM ('admin', 'member');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Helpers
CREATE OR REPLACE FUNCTION public.get_user_tenant(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.profiles WHERE id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-provision tenant + profile + role on signup
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
BEGIN
  tenant_name := COALESCE(NEW.raw_user_meta_data->>'tenant_name', split_part(NEW.email, '@', 1) || '''s workspace');
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO public.tenants (name) VALUES (tenant_name) RETURNING id INTO new_tenant_id;

  INSERT INTO public.profiles (id, tenant_id, email, full_name)
  VALUES (NEW.id, new_tenant_id, NEW.email, full_name);

  INSERT INTO public.user_roles (user_id, tenant_id, role)
  VALUES (NEW.id, new_tenant_id, 'admin');

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Policies (Robust implementation without infinite recursion)
CREATE POLICY "Users can view their tenant" ON public.tenants
    FOR SELECT TO authenticated
    USING (id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Profiles self select" ON public.profiles
    FOR SELECT TO authenticated
    USING (id = auth.uid());

CREATE POLICY "Profiles tenant select" ON public.profiles
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

CREATE POLICY "Profiles self update" ON public.profiles
    FOR UPDATE TO authenticated
    USING (id = auth.uid());

CREATE POLICY "User roles self select" ON public.user_roles
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

CREATE POLICY "User roles tenant select" ON public.user_roles
    FOR SELECT TO authenticated
    USING (tenant_id = public.get_user_tenant(auth.uid()));

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

--- END OF 20260606000000_init.sql ---

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

--- END OF 20260712000000_zernio.sql ---

-- Create public media bucket for Supabase Storage
INSERT INTO storage.buckets (id, name, public)
VALUES ('zernio-media', 'zernio-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage object policies for authenticated users
DROP POLICY IF EXISTS "Public Read Access on zernio-media" ON storage.objects;
CREATE POLICY "Public Read Access on zernio-media" ON storage.objects
    FOR SELECT USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Insert on zernio-media" ON storage.objects;
CREATE POLICY "Authenticated Insert on zernio-media" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Delete on zernio-media" ON storage.objects;
CREATE POLICY "Authenticated Delete on zernio-media" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'zernio-media');

--- END OF 20260712010000_storage.sql ---

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

--- END OF 20260712020000_automations.sql ---

-- Deduplication table for automation webhook events
-- Prevents the same comment/message from being processed multiple times
-- (loop prevention + retry idempotency)
CREATE TABLE IF NOT EXISTS zernio_automation_dedup (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL,
  event_id    TEXT NOT NULL,           -- payload.id (stable Zernio event ID)
  comment_id  TEXT,                    -- payload.comment.id or payload.message.id
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, event_id)
);

-- Auto-cleanup: events older than 24 hours are no longer relevant
-- (Zernio retries only for a few hours; 24h covers all retry windows)
CREATE INDEX IF NOT EXISTS idx_automation_dedup_created ON zernio_automation_dedup (created_at);

-- RLS: service role only (Edge Function uses service role key)
ALTER TABLE zernio_automation_dedup ENABLE ROW LEVEL SECURITY;

--- END OF 20260712030000_automation_dedup.sql ---

-- Add ai_api_key column to zernio_automations
-- This allows users to store their own AI provider API key per automation rule
ALTER TABLE public.zernio_automations
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT;

--- END OF 20260712040000_automation_ai_key.sql ---

-- Add AI provider API key columns to zernio_integrations
-- Users configure AI keys once in Settings, not per-automation
ALTER TABLE public.zernio_integrations
  ADD COLUMN IF NOT EXISTS ai_gemini_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_openai_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_anthropic_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_mistral_key TEXT,
  ADD COLUMN IF NOT EXISTS ai_groq_key TEXT;

-- Remove per-automation ai_api_key column (was added by mistake â€” keys belong in integrations)
ALTER TABLE public.zernio_automations
  DROP COLUMN IF EXISTS ai_api_key;

--- END OF 20260712050000_ai_keys_to_integrations.sql ---

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

--- END OF 20260713000000_multi_zernio.sql ---

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

--- END OF 20260713010000_automation_logs.sql ---

-- Migration to add anon permissions and select policies
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zernio_automation_logs TO anon;

CREATE POLICY "Logs tenant select anon_v2" ON public.zernio_automation_logs
    FOR SELECT TO anon
    USING (true);

CREATE POLICY "Logs tenant insert anon_v2" ON public.zernio_automation_logs
    FOR INSERT TO anon
    WITH CHECK (true);

CREATE POLICY "Logs tenant update anon_v2" ON public.zernio_automation_logs
    FOR UPDATE TO anon
    USING (true);

--- END OF 20260713020000_automation_logs_anon.sql ---

-- Enable extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Unschedules existing job if any to avoid duplicates
select cron.unschedule(jobid) from cron.job where jobname = 'zernio-sync-job';

-- Schedule the zernio-sync Edge Function to run every 2 minutes
select cron.schedule(
  'zernio-sync-job',
  '*/2 * * * *',
  $$
  select net.http_post(
    url := 'https://sabzbazyxfxorrfsnhqf.supabase.co/functions/v1/zernio-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

--- END OF 20260713030000_zernio_sync_cron.sql ---

-- Migration: Create zernio_contacts table
CREATE TABLE IF NOT EXISTS zernio_contacts (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, zernio_contact_id)
);

CREATE INDEX IF NOT EXISTS idx_zernio_contacts_tenant ON zernio_contacts (tenant_id);
CREATE INDEX IF NOT EXISTS idx_zernio_contacts_name ON zernio_contacts (tenant_id, name);

-- RLS
ALTER TABLE zernio_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_access" ON zernio_contacts;
CREATE POLICY "tenant_access" ON zernio_contacts
  FOR ALL USING (tenant_id = auth.uid());

-- Anon access for edge functions / frontend
GRANT SELECT, INSERT, UPDATE, DELETE ON zernio_contacts TO anon;
DROP POLICY IF EXISTS "anon_access" ON zernio_contacts;
CREATE POLICY "anon_access" ON zernio_contacts FOR ALL TO anon USING (true);

--- END OF 20260713040000_contacts.sql ---

