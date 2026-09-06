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
