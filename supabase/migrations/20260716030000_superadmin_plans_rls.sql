-- ========================================================
-- MIGRATION: SUPER ADMIN PLANS PERMISSIONS & RLS
-- ========================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.plans TO authenticated;
GRANT ALL ON public.plans TO service_role;

DROP POLICY IF EXISTS "Superadmin plans update" ON public.plans;
CREATE POLICY "Superadmin plans update" ON public.plans
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND LOWER(profiles.email) = 'suporte@platafy.com'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND LOWER(profiles.email) = 'suporte@platafy.com'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Superadmin plans insert" ON public.plans;
CREATE POLICY "Superadmin plans insert" ON public.plans
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND LOWER(profiles.email) = 'suporte@platafy.com'
    )
    OR
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_roles.user_id = auth.uid() 
      AND user_roles.role = 'admin'
    )
  );
