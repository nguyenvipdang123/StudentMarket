-- Read receipts for notifications derived from real marketplace events.
-- Account IDs share the global auth_identity_id_seq (students and staff).
CREATE TABLE IF NOT EXISTS notification_reads (
  account_id BIGINT NOT NULL,
  event_id TEXT NOT NULL CHECK (length(event_id) <= 240),
  read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(account_id,event_id)
);
