-- Add branding column to public.tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS branding JSONB DEFAULT '{
  "app_name": "Social Hub",
  "app_tagline": "Hub",
  "primary_color": "#ff451a",
  "logo_url": "",
  "favicon_url": ""
}'::jsonb;

-- Allow tenant admins to update their own tenant branding
DROP POLICY IF EXISTS "Tenants admin update" ON public.tenants;
CREATE POLICY "Tenants admin update" ON public.tenants
  FOR UPDATE TO authenticated
  USING (id = public.get_user_tenant(auth.uid()))
  WITH CHECK (id = public.get_user_tenant(auth.uid()) AND public.has_role(auth.uid(), 'admin'));
