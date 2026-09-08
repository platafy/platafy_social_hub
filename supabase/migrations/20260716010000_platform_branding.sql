-- 1. Criar tabela de branding global da plataforma
CREATE TABLE IF NOT EXISTS public.platform_branding (
  id INT PRIMARY KEY DEFAULT 1,
  branding JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

GRANT SELECT ON public.platform_branding TO anon, authenticated;
GRANT ALL ON public.platform_branding TO service_role;
ALTER TABLE public.platform_branding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Platform branding readable by everyone" ON public.platform_branding;
CREATE POLICY "Platform branding readable by everyone" ON public.platform_branding
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Platform branding update by superadmin" ON public.platform_branding;
CREATE POLICY "Platform branding update by superadmin" ON public.platform_branding
  FOR ALL TO authenticated
  USING (auth.jwt() ->> 'email' = 'suporte@platafy.com')
  WITH CHECK (auth.jwt() ->> 'email' = 'suporte@platafy.com');

-- 2. Inserir a identidade oficial PLATAFY Social Hub
INSERT INTO public.platform_branding (id, branding)
VALUES (
  1,
  '{
    "app_name": "PLATAFY Social",
    "app_tagline": "Hub",
    "primary_color": "#4d5b9a",
    "logo_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788795478376.png",
    "favicon_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/favicon-65aaac69-3248-446c-b846-fc602d67e8e5-1788795485699.png"
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE 
SET branding = EXCLUDED.branding, updated_at = now();

-- 3. Atualizar o padrão da coluna branding em tenants
ALTER TABLE public.tenants 
ALTER COLUMN branding SET DEFAULT '{
  "app_name": "PLATAFY Social",
  "app_tagline": "Hub",
  "primary_color": "#4d5b9a",
  "logo_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788795478376.png",
  "favicon_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/favicon-65aaac69-3248-446c-b846-fc602d67e8e5-1788795485699.png"
}'::jsonb;

-- 4. Atualizar todos os tenants que ainda estão com o branding antigo do script "Social Hub"
UPDATE public.tenants 
SET branding = '{
  "app_name": "PLATAFY Social",
  "app_tagline": "Hub",
  "primary_color": "#4d5b9a",
  "logo_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/logo-65aaac69-3248-446c-b846-fc602d67e8e5-1788795478376.png",
  "favicon_url": "https://sabzbazyxfxorrfshhgf.supabase.co/storage/v1/object/public/media/branding/favicon-65aaac69-3248-446c-b846-fc602d67e8e5-1788795485699.png"
}'::jsonb
WHERE branding->>'app_name' = 'Social Hub' OR branding->>'primary_color' = '#ff451a' OR branding->>'logo_url' = '';
