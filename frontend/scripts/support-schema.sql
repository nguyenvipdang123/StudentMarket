CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 5 AND 160),
  category TEXT NOT NULL CHECK (category IN ('ACCOUNT','LISTING','PAYMENT','TRANSACTION','OTHER')),
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED')),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS support_tickets_owner_idx ON support_tickets(owner_id,updated_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_status_idx ON support_tickets(status,updated_at DESC);
CREATE TABLE IF NOT EXISTS support_messages (
  id BIGSERIAL PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  author_account_id BIGINT NOT NULL,
  author_role TEXT NOT NULL CHECK (author_role IN ('student','admin')),
  author_name TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '' CHECK (length(content)<=4000),
  new_status TEXT CHECK (new_status IN ('OPEN','IN_PROGRESS','WAITING_USER','RESOLVED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (length(content)>0 OR new_status IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON support_messages(ticket_id,id DESC);
CREATE INDEX IF NOT EXISTS support_messages_author_idx ON support_messages(author_account_id,created_at DESC);
