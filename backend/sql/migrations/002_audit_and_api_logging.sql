-- 002_audit_and_api_logging.sql
-- Backward-compatible, additive schema upgrades for auditability + logging.
--
-- IMPORTANT:
-- - Does NOT change existing API routes/responses.
-- - Adds new tables/columns and optional triggers.
-- - All operations are idempotent where possible.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Add standard audit columns to existing auth/RBAC tables
-- ---------------------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS revoked_reason text;

ALTER TABLE rbac_roles
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE rbac_permissions
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE rbac_role_permissions
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE rbac_user_roles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE user_totp
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2) External identity provider mapping (Cognito/Google/etc)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_name text NOT NULL,
  external_user_id text NOT NULL,

  external_email text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_user_identities_user_id_users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT user_identities_provider_name_chk CHECK (length(provider_name) > 0),
  CONSTRAINT user_identities_external_user_id_chk CHECK (length(external_user_id) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_external_uq
  ON user_identities (provider_name, external_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx
  ON user_identities (user_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 3) Normalized password credentials (supports parallel IdP migration)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_password_credentials (
  user_id uuid PRIMARY KEY,
  password_hash text NOT NULL,

  password_algo text,
  password_updated_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_user_password_credentials_user_id_users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS user_password_credentials_active_idx
  ON user_password_credentials (user_id)
  WHERE deleted_at IS NULL;

-- ---------------------------------------------------------------------------
-- 4) Security / audit events
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'security_event_type') THEN
    CREATE TYPE security_event_type AS ENUM (
      'auth.login_attempt',
      'auth.token_refresh',
      'auth.logout',
      'auth.mfa.totp.enroll_attempt',
      'auth.mfa.totp.verify_attempt',
      'auth.mfa.totp.enabled',
      'auth.permission_denied',
      'admin.force_action'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  request_id text,
  event_type security_event_type NOT NULL,

  actor_user_id uuid,
  actor_system_role user_role,
  target_user_id uuid,

  action text NOT NULL,
  success boolean NOT NULL,
  failure_reason text,

  ip inet,
  user_agent text,

  http_method text,
  http_path text,
  http_status_code integer,
  error_code text,

  details jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_security_events_actor_user_id_users
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT fk_security_events_target_user_id_users
    FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT security_events_http_status_chk
    CHECK (http_status_code IS NULL OR (http_status_code >= 100 AND http_status_code <= 599))
);

CREATE INDEX IF NOT EXISTS security_events_created_at_idx ON security_events (created_at);
CREATE INDEX IF NOT EXISTS security_events_request_id_idx ON security_events (request_id);
CREATE INDEX IF NOT EXISTS security_events_actor_user_id_created_at_idx ON security_events (actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_event_type_created_at_idx ON security_events (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_error_code_created_at_idx ON security_events (error_code, created_at DESC);

-- ---------------------------------------------------------------------------
-- 5) Database-backed API request/response logs (partitioned)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_request_logs (
  occurred_at timestamptz NOT NULL,
  id bigserial,

  request_id text NOT NULL,

  http_method text NOT NULL,
  http_path text NOT NULL,

  query_params jsonb,
  request_headers jsonb,

  ip inet,
  user_agent text,

  authenticated_user_id uuid,
  authenticated_system_role user_role,

  status_code integer NOT NULL,
  duration_ms integer NOT NULL,
  error_code text,

  created_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT api_request_logs_pk PRIMARY KEY (occurred_at, id),

  CONSTRAINT fk_api_request_logs_authenticated_user_id_users
    FOREIGN KEY (authenticated_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT api_request_logs_status_chk
    CHECK (status_code >= 100 AND status_code <= 599),

  CONSTRAINT api_request_logs_duration_chk
    CHECK (duration_ms >= 0)
)
PARTITION BY RANGE (occurred_at);

-- Default partition prevents insert failures if partitions are not pre-created.
CREATE TABLE IF NOT EXISTS api_request_logs_default
  PARTITION OF api_request_logs DEFAULT;

-- Partitioned indexes (Postgres will maintain per-partition structures)
CREATE INDEX IF NOT EXISTS api_request_logs_request_id_idx
  ON api_request_logs (request_id);

CREATE INDEX IF NOT EXISTS api_request_logs_user_time_idx
  ON api_request_logs (authenticated_user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_path_time_idx
  ON api_request_logs (http_path, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_status_time_idx
  ON api_request_logs (status_code, occurred_at DESC);

CREATE INDEX IF NOT EXISTS api_request_logs_error_time_idx
  ON api_request_logs (error_code, occurred_at DESC)
  WHERE error_code IS NOT NULL;

-- Optional: BRIN index for large partitions (cheap time scans)
CREATE INDEX IF NOT EXISTS api_request_logs_occurred_at_brin
  ON api_request_logs USING brin (occurred_at);

-- ---------------------------------------------------------------------------
-- 6) updated_at trigger helper (best-effort, safe)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- users
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_users_set_updated_at') THEN
    CREATE TRIGGER trg_users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- refresh_tokens
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_refresh_tokens_set_updated_at') THEN
    CREATE TRIGGER trg_refresh_tokens_set_updated_at
    BEFORE UPDATE ON refresh_tokens
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- rbac_roles
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rbac_roles_set_updated_at') THEN
    CREATE TRIGGER trg_rbac_roles_set_updated_at
    BEFORE UPDATE ON rbac_roles
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- rbac_permissions
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_rbac_permissions_set_updated_at') THEN
    CREATE TRIGGER trg_rbac_permissions_set_updated_at
    BEFORE UPDATE ON rbac_permissions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- user_totp
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_totp_set_updated_at') THEN
    CREATE TRIGGER trg_user_totp_set_updated_at
    BEFORE UPDATE ON user_totp
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- user_identities
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_identities_set_updated_at') THEN
    CREATE TRIGGER trg_user_identities_set_updated_at
    BEFORE UPDATE ON user_identities
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;

  -- user_password_credentials
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_password_credentials_set_updated_at') THEN
    CREATE TRIGGER trg_user_password_credentials_set_updated_at
    BEFORE UPDATE ON user_password_credentials
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
  END IF;
END $$;

COMMIT;
