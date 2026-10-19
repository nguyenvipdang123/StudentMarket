CREATE TABLE IF NOT EXISTS listing_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  meeting_at TIMESTAMPTZ NOT NULL,
  location VARCHAR(240) NOT NULL CHECK (length(trim(location)) BETWEEN 5 AND 240),
  note VARCHAR(500) NOT NULL DEFAULT '',
  expires_at TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','CONFIRMED','REJECTED','CANCELLED','EXPIRED','FULFILLED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (buyer_id <> seller_id)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_one_confirmed
  ON listing_reservations(listing_id) WHERE status='CONFIRMED';
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservation_one_buyer
  ON listing_reservations(listing_id,buyer_id) WHERE status IN ('PENDING','CONFIRMED');
CREATE INDEX IF NOT EXISTS idx_reservation_buyer ON listing_reservations(buyer_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reservation_seller ON listing_reservations(seller_id,created_at DESC);
CREATE TABLE IF NOT EXISTS reservation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES listing_reservations(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(500) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_reservation_event_recipient ON reservation_events(recipient_id,created_at DESC);

-- Invalidate agreements permanently when an edited/hidden/moderated product leaves the public catalogue.
CREATE OR REPLACE FUNCTION invalidate_listing_reservations() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status<>'Active' OR NEW.moderation_status<>'APPROVED' OR NEW.seller_id IS DISTINCT FROM OLD.seller_id THEN
    WITH expired AS (
      UPDATE listing_reservations SET status='EXPIRED',updated_at=NOW()
      WHERE listing_id=NEW.id AND status IN ('PENDING','CONFIRMED') RETURNING id,buyer_id
    ) INSERT INTO reservation_events(reservation_id,recipient_id,title,body)
      SELECT id,buyer_id,'Lịch hẹn không còn hiệu lực',LEFT(NEW.title||' đã được thay đổi hoặc không còn nhận giao dịch.',500) FROM expired;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_invalidate_reservations ON products;
CREATE TRIGGER trg_invalidate_reservations AFTER UPDATE OF status,moderation_status,seller_id ON products
  FOR EACH ROW EXECUTE FUNCTION invalidate_listing_reservations();
