ALTER TABLE favorites ADD COLUMN IF NOT EXISTS price_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
  signature VARCHAR(64) NOT NULL,
  search_query VARCHAR(200) NOT NULL DEFAULT '',
  search_words TEXT[] NOT NULL DEFAULT '{}',
  category VARCHAR(40) NOT NULL DEFAULT 'Tất cả',
  kind VARCHAR(20) NOT NULL DEFAULT 'all' CHECK(kind IN ('all','sell','exchange')),
  condition VARCHAR(40) NOT NULL DEFAULT '',
  school VARCHAR(200) NOT NULL DEFAULT '',
  school_names TEXT[] NOT NULL DEFAULT '{}',
  min_price NUMERIC(12,2), max_price NUMERIC(12,2),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK(min_price IS NULL OR min_price>=0), CHECK(max_price IS NULL OR max_price>=0),
  CHECK(min_price IS NULL OR max_price IS NULL OR min_price<=max_price),
  UNIQUE(user_id,signature)
);
CREATE INDEX IF NOT EXISTS idx_saved_search_user ON saved_searches(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_search_active_category ON saved_searches(category) WHERE enabled;
CREATE TABLE IF NOT EXISTS product_alert_state (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  last_price NUMERIC(12,2) NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS saved_search_matches (
  search_id UUID NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES product_alert_state(product_id) ON DELETE CASCADE,
  PRIMARY KEY(search_id,product_id)
);
-- Baseline writes reference alert state, not the product row held by a publishing seller.
-- This avoids a product-row/advisory-lock inversion while creating or resuming a watch.
ALTER TABLE saved_search_matches DROP CONSTRAINT IF EXISTS saved_search_matches_product_id_fkey;
ALTER TABLE saved_search_matches ADD CONSTRAINT saved_search_matches_product_id_fkey
  FOREIGN KEY(product_id) REFERENCES product_alert_state(product_id) ON DELETE CASCADE;
CREATE TABLE IF NOT EXISTS product_alert_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  search_id UUID REFERENCES saved_searches(id) ON DELETE CASCADE,
  search_name VARCHAR(100),
  kind VARCHAR(20) NOT NULL CHECK(kind IN ('NEW_MATCH','PRICE_DROP')),
  old_price NUMERIC(12,2), new_price NUMERIC(12,2) NOT NULL,
  revision BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id,product_id,kind,revision)
);
CREATE INDEX IF NOT EXISTS idx_product_alert_recipient ON product_alert_events(user_id,created_at DESC);

-- Literal, accent-insensitive tokens and school aliases follow the catalogue filters.
CREATE OR REPLACE FUNCTION market_saved_search_matches(n saved_searches,p products,seller_school text,seller_name text,category_name text)
RETURNS BOOLEAN LANGUAGE sql STABLE PARALLEL SAFE AS $$
  SELECT p.status='Active' AND p.moderation_status='APPROVED' AND n.user_id IS DISTINCT FROM p.seller_id
    AND (n.category='Tất cả' OR n.category=category_name)
    AND (n.kind='all' OR n.kind='sell' AND p.price>0 OR n.kind='exchange' AND p.price=0)
    AND (n.condition='' OR n.condition=p.condition)
    AND (n.min_price IS NULL OR p.price>=n.min_price) AND (n.max_price IS NULL OR p.price<=n.max_price)
    AND (n.school='' OR market_university_text(seller_school)=ANY(n.school_names))
    AND NOT EXISTS(SELECT 1 FROM unnest(n.search_words) word WHERE
      strpos(market_search_text(COALESCE(p.title,'')||' '||COALESCE(p.description,'')||' '||COALESCE(p.location,'')),word)=0
      AND strpos(market_search_text(COALESCE(seller_name,'')||' '||COALESCE(seller_school,'')),word)=0
      AND strpos(market_search_text(category_name),word)=0)
$$;

-- Establish the existing public price, without sending historical notifications.
INSERT INTO product_alert_state(product_id,last_price)
  SELECT id,price FROM products WHERE status='Active' AND moderation_status='APPROVED'
  ON CONFLICT(product_id) DO NOTHING;

CREATE OR REPLACE FUNCTION publish_product_alerts() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE previous_price NUMERIC; current_revision BIGINT; school_text TEXT; seller_text TEXT; category_text TEXT;
BEGIN
  IF NEW.status<>'Active' OR NEW.moderation_status<>'APPROVED' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' THEN
    IF ROW(NEW.status,NEW.moderation_status,NEW.price,NEW.title,NEW.description,NEW.location,NEW.category_id,NEW.condition,NEW.seller_id)
      IS NOT DISTINCT FROM ROW(OLD.status,OLD.moderation_status,OLD.price,OLD.title,OLD.description,OLD.location,OLD.category_id,OLD.condition,OLD.seller_id)
      THEN RETURN NEW; END IF;
  END IF;
  -- Serialize watch creation/resumption against publication so its baseline cannot miss a new listing.
  PERFORM pg_advisory_xact_lock(732619204);
  SELECT last_price INTO previous_price FROM product_alert_state WHERE product_id=NEW.id FOR UPDATE;
  INSERT INTO product_alert_state(product_id,last_price) VALUES(NEW.id,NEW.price)
    ON CONFLICT(product_id) DO UPDATE SET last_price=EXCLUDED.last_price,revision=product_alert_state.revision+1
    RETURNING revision INTO current_revision;
  SELECT university,full_name INTO school_text,seller_text FROM users WHERE id=NEW.seller_id;
  SELECT name INTO category_text FROM categories WHERE id=NEW.category_id;
  WITH fresh AS (
    INSERT INTO saved_search_matches(search_id,product_id)
    SELECT n.id,NEW.id FROM saved_searches n JOIN users u ON u.id=n.user_id
    WHERE n.enabled AND u.auth_status='verified' AND market_saved_search_matches(n,NEW,school_text,seller_text,category_text)
    ON CONFLICT DO NOTHING RETURNING search_id
  ) INSERT INTO product_alert_events(user_id,product_id,search_id,search_name,kind,new_price,revision)
    SELECT DISTINCT ON(n.user_id) n.user_id,NEW.id,n.id,n.name,'NEW_MATCH',NEW.price,current_revision
    FROM fresh f JOIN saved_searches n ON n.id=f.search_id ORDER BY n.user_id,n.created_at,n.id
    ON CONFLICT DO NOTHING;
  IF previous_price>NEW.price THEN
    INSERT INTO product_alert_events(user_id,product_id,kind,old_price,new_price,revision)
      SELECT f.user_id,NEW.id,'PRICE_DROP',previous_price,NEW.price,current_revision
      FROM favorites f JOIN users u ON u.id=f.user_id WHERE f.product_id=NEW.id
        AND f.price_alert_enabled AND f.user_id IS DISTINCT FROM NEW.seller_id AND u.auth_status='verified'
      ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_publish_product_alerts ON products;
CREATE TRIGGER trg_publish_product_alerts AFTER INSERT OR UPDATE OF price,status,moderation_status,title,description,location,category_id,condition,seller_id
  ON products FOR EACH ROW EXECUTE FUNCTION publish_product_alerts();
