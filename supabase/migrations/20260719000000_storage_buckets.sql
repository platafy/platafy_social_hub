-- Ensure storage extension and schema are ready
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Create or ensure buckets 'zernio-media' and 'media' exist as public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('zernio-media', 'zernio-media', true, 52428800, null),
  ('media', 'media', true, 52428800, null)
ON CONFLICT (id) DO UPDATE SET 
  public = true,
  file_size_limit = 52428800;

-- 2. Storage object policies for zernio-media
DROP POLICY IF EXISTS "Public Read Access on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read on zernio-media" ON storage.objects;
CREATE POLICY "Public Read Access on zernio-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Insert on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Insert on zernio-media" ON storage.objects;
CREATE POLICY "Allow Insert on zernio-media" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Allow Update on zernio-media" ON storage.objects;
CREATE POLICY "Allow Update on zernio-media" ON storage.objects
  FOR UPDATE TO authenticated, anon
  USING (bucket_id = 'zernio-media');

DROP POLICY IF EXISTS "Authenticated Delete on zernio-media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete on zernio-media" ON storage.objects;
CREATE POLICY "Allow Delete on zernio-media" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'zernio-media');

-- 3. Storage object policies for media bucket
DROP POLICY IF EXISTS "Public Read Access on media" ON storage.objects;
DROP POLICY IF EXISTS "Public Read on media" ON storage.objects;
CREATE POLICY "Public Read Access on media" ON storage.objects
  FOR SELECT USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated Insert on media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Insert on media" ON storage.objects;
CREATE POLICY "Allow Insert on media" ON storage.objects
  FOR INSERT TO authenticated, anon
  WITH CHECK (bucket_id = 'media');

DROP POLICY IF EXISTS "Allow Update on media" ON storage.objects;
CREATE POLICY "Allow Update on media" ON storage.objects
  FOR UPDATE TO authenticated, anon
  USING (bucket_id = 'media');

DROP POLICY IF EXISTS "Authenticated Delete on media" ON storage.objects;
DROP POLICY IF EXISTS "Allow Delete on media" ON storage.objects;
CREATE POLICY "Allow Delete on media" ON storage.objects
  FOR DELETE TO authenticated, anon
  USING (bucket_id = 'media');
