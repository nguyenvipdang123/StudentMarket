-- Normalization and indexes shared by public catalogue filters and searches.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION market_search_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT replace(regexp_replace(normalize(lower(COALESCE(value,'')), NFD), U&'[\0300-\036f]', '', 'g'), 'đ', 'd')
$$;

CREATE OR REPLACE FUNCTION market_university_text(value text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            regexp_replace(replace(public.market_search_text(value), '&', ' va '), '[^a-z0-9]+', ' ', 'g'),
            '\m(truong )?dai hoc\M', 'dh', 'g'),
          '\mtruong dh\M', 'dh', 'g'),
        '\m(thanh pho|tp) ho chi minh\M', 'tp hcm', 'g'),
      '\mtphcm\M', 'tp hcm', 'g'),
    '\s+', ' ', 'g'))
$$;

CREATE INDEX IF NOT EXISTS idx_products_public_recent ON products(created_at DESC, id DESC)
  WHERE status='Active' AND moderation_status='APPROVED';
CREATE INDEX IF NOT EXISTS idx_products_public_price ON products(price, created_at DESC, id DESC)
  WHERE status='Active' AND moderation_status='APPROVED';
CREATE INDEX IF NOT EXISTS idx_products_public_category ON products(category_id, created_at DESC, id DESC)
  WHERE status='Active' AND moderation_status='APPROVED';
CREATE INDEX IF NOT EXISTS idx_products_public_search ON products USING gin
  (market_search_text(COALESCE(title,'') || ' ' || COALESCE(description,'') || ' ' || COALESCE(location,'')) gin_trgm_ops)
  WHERE status='Active' AND moderation_status='APPROVED';
CREATE INDEX IF NOT EXISTS idx_users_market_search ON users USING gin
  (market_search_text(COALESCE(full_name,'') || ' ' || COALESCE(university,'')) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_market_school ON users(market_university_text(university));
