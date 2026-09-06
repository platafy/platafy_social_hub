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
