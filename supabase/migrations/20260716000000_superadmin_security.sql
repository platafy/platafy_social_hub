-- Restringir platform_settings estritamente para o super admin (suporte@platafy.com)
DROP POLICY IF EXISTS "Platform settings admin select" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform settings admin update" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform settings superadmin select" ON public.platform_settings;
DROP POLICY IF EXISTS "Platform settings superadmin update" ON public.platform_settings;

CREATE POLICY "Platform settings superadmin select" ON public.platform_settings
  FOR SELECT TO authenticated 
  USING (auth.jwt() ->> 'email' = 'suporte@platafy.com');

CREATE POLICY "Platform settings superadmin update" ON public.platform_settings
  FOR UPDATE TO authenticated 
  USING (auth.jwt() ->> 'email' = 'suporte@platafy.com');
