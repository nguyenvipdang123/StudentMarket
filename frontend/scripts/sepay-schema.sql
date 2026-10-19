-- Preserve financial history and snapshot the package/recipient at checkout.
ALTER TABLE promotion_orders
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS package_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS duration_hours_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS priority_snapshot INTEGER,
  ADD COLUMN IF NOT EXISTS payment_details JSONB,
  ADD COLUMN IF NOT EXISTS sepay_transaction_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS review_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

ALTER TABLE promotion_orders DROP CONSTRAINT IF EXISTS promotion_orders_payment_status_check;
ALTER TABLE promotion_orders ADD CONSTRAINT promotion_orders_payment_status_check
  CHECK (payment_status IN ('PENDING','PAID','FAILED','REFUNDED','CANCELLED'));

ALTER TABLE listing_promotions
  ADD COLUMN IF NOT EXISTS package_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS priority_snapshot INTEGER;

ALTER TABLE promotion_orders DROP CONSTRAINT IF EXISTS promotion_orders_listing_id_fkey;
ALTER TABLE promotion_orders ADD CONSTRAINT promotion_orders_listing_id_fkey
  FOREIGN KEY(listing_id) REFERENCES products(id) ON DELETE RESTRICT;
ALTER TABLE promotion_orders DROP CONSTRAINT IF EXISTS promotion_orders_user_id_fkey;
ALTER TABLE promotion_orders ADD CONSTRAINT promotion_orders_user_id_fkey
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE RESTRICT;

CREATE TABLE IF NOT EXISTS sepay_payment_events (
  transaction_id BIGINT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  order_id UUID REFERENCES promotion_orders(id) ON DELETE SET NULL,
  amount NUMERIC(16,0) NOT NULL,
  gateway TEXT NOT NULL,
  account_number TEXT NOT NULL,
  sub_account TEXT NOT NULL DEFAULT '',
  reference_code TEXT NOT NULL DEFAULT '',
  transfer_type TEXT NOT NULL,
  content TEXT NOT NULL,
  transaction_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('RECEIVED','APPLIED','REVIEW','IGNORED')),
  reason TEXT NOT NULL DEFAULT '',
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS sepay_events_order_idx ON sepay_payment_events(order_id);
CREATE INDEX IF NOT EXISTS sepay_events_status_idx ON sepay_payment_events(status,received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS sepay_events_reference_idx
  ON sepay_payment_events(gateway,account_number,reference_code) WHERE reference_code<>'' AND transfer_type='in';
CREATE INDEX IF NOT EXISTS promotion_orders_pending_idx ON promotion_orders(listing_id,expires_at) WHERE payment_status='PENDING';
