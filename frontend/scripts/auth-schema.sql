-- Physical authentication storage: staff_accounts for admin/staff, users for students.
-- auth_identities is a writable compatibility view for the Next.js auth routes.
-- This file also upgrades the former public.accounts table inside the caller's transaction.

CREATE SEQUENCE IF NOT EXISTS auth_identity_id_seq AS BIGINT;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth_id BIGINT UNIQUE,
  ADD COLUMN IF NOT EXISTS auth_status TEXT,
  ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS card_path TEXT,
  ADD COLUMN IF NOT EXISTS verified_at BIGINT,
  ADD COLUMN IF NOT EXISTS auth_created_at BIGINT;

DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid = to_regclass('public.accounts') AND relkind IN ('r','p')) THEN
    ALTER TABLE accounts RENAME TO staff_accounts;
    ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_account_id_fkey;
    ALTER TABLE email_verifications DROP CONSTRAINT IF EXISTS email_verifications_account_id_fkey;

    INSERT INTO users (id,full_name,email,student_id,university,role,auth_type,status,created_at)
    SELECT gen_random_uuid(),a.full_name,a.email,a.student_id,a.university,'Student',
           CASE WHEN a.google_sub IS NULL THEN 'Email' ELSE 'Google' END,
           CASE a.status WHEN 'verified' THEN 'Verified' WHEN 'locked' THEN 'Locked' ELSE 'Pending' END,
           to_timestamp(a.created_at / 1000.0)
      FROM staff_accounts a
     WHERE a.role='student' AND NOT EXISTS (SELECT 1 FROM users u WHERE LOWER(u.email)=LOWER(a.email));

    UPDATE users u SET auth_id=a.id, password_hash=a.password_hash, google_sub=a.google_sub,
      auth_status=a.status, card_path=a.card_path, verified_at=a.verified_at,
      auth_created_at=a.created_at, role='Student',
      status=CASE a.status WHEN 'verified' THEN 'Verified' WHEN 'locked' THEN 'Locked' ELSE 'Pending' END,
      updated_at=NOW()
      FROM staff_accounts a WHERE a.role='student' AND LOWER(u.email)=LOWER(a.email);

    IF (SELECT COUNT(*) FROM staff_accounts WHERE role='student') <> (SELECT COUNT(*) FROM users WHERE auth_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Student identity migration count mismatch';
    END IF;
    DELETE FROM staff_accounts WHERE role='student';
    DROP INDEX IF EXISTS accounts_email_ci;
    DROP INDEX IF EXISTS accounts_student_id_ci;
  END IF;
END $migration$;

CREATE TABLE IF NOT EXISTS staff_accounts (
  id BIGINT PRIMARY KEY DEFAULT nextval('auth_identity_id_seq'),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  student_id TEXT NOT NULL,
  university TEXT NOT NULL,
  password_hash TEXT,
  google_sub TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('pending_email','pending_review','verified','locked')),
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('admin','staff')),
  card_path TEXT,
  created_at BIGINT NOT NULL,
  verified_at BIGINT
);

ALTER TABLE staff_accounts ALTER COLUMN id DROP IDENTITY IF EXISTS;
ALTER TABLE staff_accounts ALTER COLUMN id SET DEFAULT nextval('auth_identity_id_seq');
ALTER TABLE staff_accounts ALTER COLUMN role SET DEFAULT 'staff';
ALTER TABLE staff_accounts ADD COLUMN IF NOT EXISTS actor_id UUID;
UPDATE staff_accounts s SET actor_id=u.id FROM users u
 WHERE LOWER(s.email)=LOWER(u.email) AND u.role IN ('Admin','Staff') AND s.actor_id IS NULL;
UPDATE staff_accounts SET actor_id=gen_random_uuid() WHERE actor_id IS NULL;
ALTER TABLE staff_accounts ALTER COLUMN actor_id SET DEFAULT gen_random_uuid();
ALTER TABLE staff_accounts ALTER COLUMN actor_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_actor_id_unique ON staff_accounts(actor_id);
DO $constraint$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='staff_accounts_role_only' AND conrelid='staff_accounts'::regclass) THEN
    ALTER TABLE staff_accounts ADD CONSTRAINT staff_accounts_role_only CHECK (role IN ('admin','staff'));
  END IF;
END $constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_email_ci ON staff_accounts(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS staff_accounts_student_id_ci ON staff_accounts(LOWER(student_id));
CREATE UNIQUE INDEX IF NOT EXISTS users_email_ci ON users(LOWER(email));
CREATE UNIQUE INDEX IF NOT EXISTS users_auth_id_unique ON users(auth_id) WHERE auth_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_google_sub_unique ON users(google_sub) WHERE google_sub IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_status_check;
ALTER TABLE users ADD CONSTRAINT users_auth_status_check
  CHECK (auth_status IS NULL OR auth_status IN ('pending_email','pending_review','verified','locked'));

-- Keep administrative history tied to staff_accounts instead of shadow rows in users.
DO $staff_references$
DECLARE
  reference RECORD;
  has_staff_data BOOLEAN;
BEGIN
  FOR reference IN
    SELECT c.conrelid::regclass AS table_name, a.attname AS column_name
      FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=c.conkey[1]
     WHERE c.contype='f' AND c.confrelid='users'::regclass
       AND (c.conrelid=to_regclass('public.audit_logs') AND a.attname='actor_id') IS NOT TRUE
       AND (c.conrelid='products'::regclass AND a.attname='moderated_by') IS NOT TRUE
  LOOP
    EXECUTE format('SELECT EXISTS(SELECT 1 FROM %s t JOIN users u ON t.%I=u.id JOIN staff_accounts s ON LOWER(s.email)=LOWER(u.email) WHERE u.role IN (''Admin'',''Staff''))',
      reference.table_name,reference.column_name) INTO has_staff_data;
    IF has_staff_data THEN
      RAISE EXCEPTION 'Staff profile is referenced by %.%; manual migration required',reference.table_name,reference.column_name;
    END IF;
  END LOOP;

  IF to_regclass('public.audit_logs') IS NOT NULL THEN
    ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_actor_id_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='audit_logs_staff_actor_fkey') THEN
      ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_staff_actor_fkey
        FOREIGN KEY(actor_id) REFERENCES staff_accounts(actor_id) ON DELETE SET NULL;
    END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='products' AND column_name='moderated_by') THEN
    ALTER TABLE products DROP CONSTRAINT IF EXISTS products_moderated_by_fkey;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_staff_moderator_fkey') THEN
      ALTER TABLE products ADD CONSTRAINT products_staff_moderator_fkey
        FOREIGN KEY(moderated_by) REFERENCES staff_accounts(actor_id) ON DELETE SET NULL;
    END IF;
  END IF;
  DELETE FROM users u USING staff_accounts s
   WHERE LOWER(s.email)=LOWER(u.email) AND u.role IN ('Admin','Staff');
END $staff_references$;

CREATE TABLE IF NOT EXISTS email_verifications (
  account_id BIGINT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  account_id BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_account_id_idx ON sessions(account_id);
CREATE TABLE IF NOT EXISTS google_onboarding (
  token_hash TEXT PRIMARY KEY,
  google_sub TEXT NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key TEXT PRIMARY KEY,
  failures INTEGER NOT NULL DEFAULT 0,
  blocked_until BIGINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS account_email_codes (
  account_id BIGINT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('register','reset')),
  code_hash TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  sent_at BIGINT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
  window_started_at BIGINT NOT NULL,
  send_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY(account_id,purpose)
);

SELECT setval('auth_identity_id_seq', GREATEST(
  (SELECT last_value FROM auth_identity_id_seq),
  (SELECT COALESCE(MAX(id),0) FROM staff_accounts),
  (SELECT COALESCE(MAX(auth_id),0) FROM users),1), true);

CREATE OR REPLACE VIEW auth_identities AS
  SELECT id,full_name,email,student_id,university,password_hash,google_sub,status,role,
         card_path,created_at,verified_at FROM staff_accounts
  UNION ALL
  SELECT auth_id AS id,full_name,email,student_id,university,password_hash,google_sub,
         auth_status AS status,'student'::text AS role,card_path,
         auth_created_at AS created_at,verified_at
    FROM users WHERE auth_id IS NOT NULL;

CREATE OR REPLACE FUNCTION write_auth_identity() RETURNS trigger LANGUAGE plpgsql AS $function$
DECLARE
  identity_id BIGINT;
  identity_role TEXT;
BEGIN
  IF TG_OP='INSERT' THEN
    identity_role := COALESCE(NEW.role,'student');
    NEW.email := LOWER(NEW.email);
    PERFORM pg_advisory_xact_lock(hashtext(NEW.email));
    IF EXISTS (SELECT 1 FROM staff_accounts WHERE LOWER(email)=NEW.email)
       OR EXISTS (SELECT 1 FROM users WHERE LOWER(email)=NEW.email AND (identity_role='student' OR auth_id IS NOT NULL)) THEN
      RAISE EXCEPTION 'Email already registered' USING ERRCODE='23505';
    END IF;
    identity_id := COALESCE(NEW.id,nextval('auth_identity_id_seq'));
    NEW.id := identity_id;
    NEW.created_at := COALESCE(NEW.created_at,(EXTRACT(EPOCH FROM clock_timestamp())*1000)::BIGINT);
    IF identity_role='student' THEN
      NEW.role := 'student';
      INSERT INTO users(id,full_name,email,student_id,university,password_hash,role,auth_type,
        status,created_at,auth_id,auth_status,google_sub,card_path,verified_at,auth_created_at)
      VALUES(gen_random_uuid(),NEW.full_name,NEW.email,NEW.student_id,NEW.university,NEW.password_hash,
        'Student',CASE WHEN NEW.google_sub IS NULL THEN 'Email' ELSE 'Google' END,
        CASE NEW.status WHEN 'verified' THEN 'Verified' WHEN 'locked' THEN 'Locked' ELSE 'Pending' END,
        to_timestamp(NEW.created_at/1000.0),identity_id,NEW.status,NEW.google_sub,NEW.card_path,
        NEW.verified_at,NEW.created_at);
    ELSIF identity_role IN ('admin','staff') THEN
      NEW.role := identity_role;
      INSERT INTO staff_accounts(id,full_name,email,student_id,university,password_hash,google_sub,
        status,role,card_path,created_at,verified_at)
      VALUES(identity_id,NEW.full_name,NEW.email,NEW.student_id,NEW.university,NEW.password_hash,
        NEW.google_sub,NEW.status,identity_role,NEW.card_path,NEW.created_at,NEW.verified_at);
    ELSE
      RAISE EXCEPTION 'Invalid identity role';
    END IF;
    RETURN NEW;
  ELSIF TG_OP='UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.role IS DISTINCT FROM OLD.role
       OR NEW.email IS DISTINCT FROM OLD.email OR NEW.student_id IS DISTINCT FROM OLD.student_id THEN
      RAISE EXCEPTION 'Identity key and role cannot be changed';
    END IF;
    IF OLD.role='student' THEN
      UPDATE users SET full_name=NEW.full_name,university=NEW.university,password_hash=NEW.password_hash,
        auth_status=NEW.status,status=CASE NEW.status WHEN 'verified' THEN 'Verified'
          WHEN 'locked' THEN 'Locked' ELSE 'Pending' END,card_path=NEW.card_path,
        verified_at=NEW.verified_at,updated_at=NOW() WHERE auth_id=OLD.id;
    ELSE
      UPDATE staff_accounts SET full_name=NEW.full_name,university=NEW.university,
        password_hash=NEW.password_hash,status=NEW.status,card_path=NEW.card_path,
        verified_at=NEW.verified_at WHERE id=OLD.id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP='DELETE' THEN
    DELETE FROM sessions WHERE account_id=OLD.id;
    DELETE FROM email_verifications WHERE account_id=OLD.id;
    DELETE FROM account_email_codes WHERE account_id=OLD.id;
    IF OLD.role='student' THEN DELETE FROM users WHERE auth_id=OLD.id;
    ELSE DELETE FROM staff_accounts WHERE id=OLD.id; END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS auth_identities_write ON auth_identities;
CREATE TRIGGER auth_identities_write INSTEAD OF INSERT OR UPDATE OR DELETE ON auth_identities
  FOR EACH ROW EXECUTE FUNCTION write_auth_identity();

CREATE OR REPLACE FUNCTION check_auth_reference() RETURNS trigger LANGUAGE plpgsql AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth_identities WHERE id=NEW.account_id) THEN
    RAISE EXCEPTION 'Identity does not exist' USING ERRCODE='23503';
  END IF;
  RETURN NEW;
END $function$;
DROP TRIGGER IF EXISTS sessions_identity_check ON sessions;
CREATE TRIGGER sessions_identity_check BEFORE INSERT OR UPDATE OF account_id ON sessions
  FOR EACH ROW EXECUTE FUNCTION check_auth_reference();
DROP TRIGGER IF EXISTS email_verifications_identity_check ON email_verifications;
CREATE TRIGGER email_verifications_identity_check BEFORE INSERT OR UPDATE OF account_id ON email_verifications
  FOR EACH ROW EXECUTE FUNCTION check_auth_reference();
DROP TRIGGER IF EXISTS account_email_codes_identity_check ON account_email_codes;
CREATE TRIGGER account_email_codes_identity_check BEFORE INSERT OR UPDATE OF account_id ON account_email_codes
  FOR EACH ROW EXECUTE FUNCTION check_auth_reference();

-- Short-lived browser-to-native OAuth handoff. The app holds the PKCE verifier;
-- browser URLs contain no session cookie or Google/onboarding bearer token.
CREATE TABLE IF NOT EXISTS mobile_google_flows (
  id_hash TEXT PRIMARY KEY,
  client_challenge TEXT NOT NULL,
  oauth_state TEXT NOT NULL,
  oauth_nonce TEXT NOT NULL,
  oauth_verifier TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  outcome JSONB,
  claimed_at BIGINT
);
CREATE INDEX IF NOT EXISTS mobile_google_flows_expiry ON mobile_google_flows(expires_at);
