-- Additive migration; does not approve or change any existing listing.
CREATE TABLE IF NOT EXISTS listing_ai_reviews (
  listing_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  fingerprint VARCHAR(64) NOT NULL,
  content_revision TEXT NOT NULL,
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('PROCESSING','APPROVED','REVIEW','ERROR')),
  confidence DOUBLE PRECISION CHECK (confidence BETWEEN 0 AND 1),
  reason TEXT NOT NULL DEFAULT '',
  flags JSONB NOT NULL DEFAULT '[]',
  model TEXT NOT NULL,
  policy_version TEXT NOT NULL DEFAULT 'sangtay-listings-v1',
  images_checked INTEGER NOT NULL DEFAULT 0,
  auto_approved BOOLEAN NOT NULL DEFAULT FALSE,
  reviewed_by UUID REFERENCES staff_accounts(actor_id) ON DELETE SET NULL,
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  retry_after TIMESTAMPTZ,
  lease_until TIMESTAMPTZ,
  claim_token UUID
);

-- Old pending reviews are eligible for re-evaluation when the policy changes.
ALTER TABLE listing_ai_reviews ADD COLUMN IF NOT EXISTS policy_version TEXT NOT NULL DEFAULT 'sangtay-listings-v1';

-- Singleton server-side switch. A verified Admin must explicitly enable it.
CREATE TABLE IF NOT EXISTS ai_moderation_control (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  actor_id UUID REFERENCES staff_accounts(actor_id) ON DELETE SET NULL,
  generation BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  heartbeat_at TIMESTAMPTZ,
  last_scan_at TIMESTAMPTZ,
  last_error TEXT NOT NULL DEFAULT '',
  worker_id UUID
);
INSERT INTO ai_moderation_control(id) VALUES(TRUE) ON CONFLICT(id) DO NOTHING;
