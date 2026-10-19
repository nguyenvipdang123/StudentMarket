-- SangTay tables used by the Next.js API and FastAPI service.
-- Run after the EF InitialCreate migration. This file is safe to rerun.
-- The runner executes it inside one PostgreSQL transaction.

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderation_status VARCHAR(20) NOT NULL DEFAULT 'APPROVED',
  ADD COLUMN IF NOT EXISTS moderated_by UUID REFERENCES staff_accounts(actor_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE products SET seller_id = user_id WHERE seller_id IS NULL;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS view_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_packages (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  duration_hours INTEGER NOT NULL,
  price NUMERIC(12, 2) NOT NULL,
  priority INTEGER NOT NULL DEFAULT 10,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Remove packages from the catalogue while preserving paid orders and purchased benefits.
ALTER TABLE promotion_packages ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS listing_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES promotion_packages(id),
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'ACTIVE', 'EXPIRED', 'CANCELLED')),
  start_at TIMESTAMPTZ,
  end_at TIMESTAMPTZ,
  price NUMERIC(12, 2) NOT NULL,
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  transaction_id VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promotion_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  package_id INTEGER NOT NULL REFERENCES promotion_packages(id),
  promotion_id UUID REFERENCES listing_promotions(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL,
  payment_method VARCHAR(50) NOT NULL DEFAULT 'VNPAY',
  payment_status VARCHAR(20) NOT NULL DEFAULT 'PENDING'
    CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
  transaction_code VARCHAR(100) UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES staff_accounts(actor_id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES users(id),
  reported_user_id UUID NOT NULL REFERENCES users(id),
  context_type VARCHAR(20) NOT NULL CHECK (context_type IN ('LISTING', 'CONVERSATION')),
  context_id UUID NOT NULL,
  context_title TEXT NOT NULL,
  reason VARCHAR(30) NOT NULL CHECK (reason IN ('SCAM', 'HARASSMENT', 'MISLEADING', 'OTHER')),
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  reviewed_by UUID REFERENCES staff_accounts(actor_id) ON DELETE SET NULL,
  review_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  CONSTRAINT user_reports_no_self_report CHECK (reporter_id <> reported_user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_reports_one_pending
  ON user_reports (reporter_id, reported_user_id, context_type, context_id)
  WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_user_reports_status_created ON user_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reports_reported_user ON user_reports (reported_user_id);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES products(id),
  seller_id UUID REFERENCES users(id),
  buyer_id UUID REFERENCES users(id),
  status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
  sale_source VARCHAR(20) NOT NULL DEFAULT 'SANGTAY',
  seller_confirmed_at TIMESTAMPTZ,
  buyer_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS listing_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON products (seller_id);
CREATE INDEX IF NOT EXISTS idx_products_moderation_status ON products (moderation_status);
CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_view_history_user_id ON view_history (user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer_id ON reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_target_user_id ON reviews (target_user_id);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_listing_id ON listing_promotions (listing_id);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_status ON listing_promotions (status);
CREATE INDEX IF NOT EXISTS idx_listing_promotions_end_at ON listing_promotions (end_at);
CREATE INDEX IF NOT EXISTS idx_promotion_orders_payment_status ON promotion_orders (payment_status);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS idx_listing_analytics_listing_id ON listing_analytics (listing_id);

ALTER TABLE reviews ADD COLUMN IF NOT EXISTS transaction_id UUID REFERENCES transactions(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_review_transaction_author ON reviews(transaction_id,reviewer_id) WHERE transaction_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_sale_per_listing ON transactions(listing_id) WHERE status IN ('SELLER_CONFIRMED','COMPLETED');

ALTER TABLE listing_analytics ADD COLUMN IF NOT EXISTS visitor_id VARCHAR(64);

INSERT INTO categories(id,name,slug,sort_order) VALUES
 (1,'Học tập','hoc-tap',1),(2,'Công nghệ','cong-nghe',2),(3,'Nội thất','noi-that',3),
 (4,'Thời trang','thoi-trang',4),(5,'Khác','khac',5)
 ON CONFLICT(id) DO NOTHING;
SELECT setval(pg_get_serial_sequence('categories','id'), (SELECT MAX(id) FROM categories));
