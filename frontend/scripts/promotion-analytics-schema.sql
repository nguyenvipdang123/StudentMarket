-- Timestamped saves survive removal from favorites; never infer past events from today's total.
CREATE TABLE IF NOT EXISTS analytics_tracking (
  event_type VARCHAR(20) PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO analytics_tracking(event_type) VALUES('FAVORITE') ON CONFLICT DO NOTHING;
CREATE INDEX IF NOT EXISTS idx_listing_analytics_period ON listing_analytics(listing_id,event_type,created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_product_buyer ON conversations(product_id,buyer_id);

CREATE OR REPLACE FUNCTION record_favorite_analytics() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO listing_analytics(listing_id,user_id,event_type,created_at)
    SELECT NEW.product_id,NEW.user_id,'FAVORITE',NEW.created_at
    FROM products p WHERE p.id=NEW.product_id AND NEW.user_id<>COALESCE(p.seller_id,p.user_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_favorite_analytics ON favorites;
CREATE TRIGGER trg_favorite_analytics AFTER INSERT ON favorites
  FOR EACH ROW EXECUTE FUNCTION record_favorite_analytics();

-- Only recover saves whose original timestamp is still known. Coverage metadata marks older history partial.
INSERT INTO listing_analytics(listing_id,user_id,event_type,created_at)
  SELECT f.product_id,f.user_id,'FAVORITE',f.created_at FROM favorites f JOIN products p ON p.id=f.product_id
  WHERE f.user_id<>COALESCE(p.seller_id,p.user_id) AND NOT EXISTS (
    SELECT 1 FROM listing_analytics a WHERE a.listing_id=f.product_id AND a.user_id=f.user_id
      AND a.event_type='FAVORITE' AND a.created_at=f.created_at
  );
