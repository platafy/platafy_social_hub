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
