-- auth_rbac_audit_logging_v2.sql
-- DESIGN-ONLY (NOT auto-applied): place outside sql/migrations/ so db:migrate won't execute it.
--
-- Goals
-- - Normalize auth + RBAC schema (industry-standard)
-- - Add soft deletes and auditability (created_at/updated_at/deleted_at everywhere)
-- - Add external IdP mapping (Cognito/Google/etc) without breaking current behavior
-- - Add security/audit event tables for auth flows and authorization denials
-- - Add high-volume, partitioned API request/response logging tables
--
-- Backward compatibility strategy
-- - Keep existing tables and columns used by the app today.
-- - Add new tables/columns with NULL defaults.
-- - Prefer additive UNIQUE indexes with WHERE deleted_at IS NULL.
-- - Defer any data backfill or application wiring until explicitly scheduled.

BEGIN;

-- ============================================================================
-- 0) Conventions & shared types
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Existing enum already used by the app.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'DRIVER', 'PASSENGER');
  END IF;
END $$;

-- Normalized provider name. Keep as TEXT for flexibility (new providers without DDL).
-- If you prefer tighter constraints, convert to ENUM later.

-- Security event type.
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

-- ============================================================================
-- 1) AUTH & RBAC schema standardization (additive to existing)
-- ============================================================================

-- Users table currently contains password_hash and is_active.
-- Target state: users stores identity + system role; credentials are stored in a credentials table.
-- For backward compatibility: keep users.password_hash for now; introduce credentials table in parallel.

-- 1.1 Soft deletes and updated_at standardization on existing tables
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Optional (recommended): capture when a user last authenticated.
-- Keep nullable; application can backfill later.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Refresh tokens already has issued_at/expires_at; add standard columns.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- Optional: record why/how a token was revoked for investigations.
ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS revoked_reason text;

-- RBAC tables currently lack updated_at/deleted_at.
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

-- NOTE on RBAC join tables + soft deletes:
-- The existing schema uses composite PKs on (user_id, role_id) and (role_id, permission_id).
-- That prevents multiple historical rows per pair.
-- Industry-standard approach for auditability is:
--   - a surrogate PK (id)
--   - "active" uniqueness via partial UNIQUE indexes (WHERE deleted_at IS NULL)
--   - optional actor columns (created_by_user_id) for who granted/revoked
--
-- To keep runtime behavior stable, introduce new history-capable tables in parallel.
-- The application can continue using the existing tables until migrated.

CREATE TABLE IF NOT EXISTS rbac_user_role_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role_id uuid NOT NULL,

  granted_by_user_id uuid,
  granted_reason text,
  revoked_by_user_id uuid,
  revoked_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_rbac_user_role_assignments_user_id_users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT fk_rbac_user_role_assignments_role_id_rbac_roles
    FOREIGN KEY (role_id) REFERENCES rbac_roles(id) ON DELETE CASCADE,

  CONSTRAINT fk_rbac_user_role_assignments_granted_by_user_id_users
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT fk_rbac_user_role_assignments_revoked_by_user_id_users
    FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_user_role_assignments_active_uq
  ON rbac_user_role_assignments (user_id, role_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS rbac_user_role_assignments_user_id_idx
  ON rbac_user_role_assignments (user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS rbac_user_role_assignments_role_id_idx
  ON rbac_user_role_assignments (role_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS rbac_role_permission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL,
  permission_id uuid NOT NULL,

  granted_by_user_id uuid,
  granted_reason text,
  revoked_by_user_id uuid,
  revoked_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_rbac_role_permission_assignments_role_id_rbac_roles
    FOREIGN KEY (role_id) REFERENCES rbac_roles(id) ON DELETE CASCADE,

  CONSTRAINT fk_rbac_role_permission_assignments_permission_id_rbac_permissions
    FOREIGN KEY (permission_id) REFERENCES rbac_permissions(id) ON DELETE CASCADE,

  CONSTRAINT fk_rbac_role_permission_assignments_granted_by_user_id_users
    FOREIGN KEY (granted_by_user_id) REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT fk_rbac_role_permission_assignments_revoked_by_user_id_users
    FOREIGN KEY (revoked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS rbac_role_permission_assignments_active_uq
  ON rbac_role_permission_assignments (role_id, permission_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS rbac_role_permission_assignments_role_id_idx
  ON rbac_role_permission_assignments (role_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS rbac_role_permission_assignments_permission_id_idx
  ON rbac_role_permission_assignments (permission_id)
  WHERE deleted_at IS NULL;

-- TOTP table (user_totp) already has timestamps; add deleted_at.
ALTER TABLE user_totp
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 1.2 External identity provider compatibility
-- One internal user can be linked to many external identities (Cognito + Google, etc).
CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  provider_name text NOT NULL,
  external_user_id text NOT NULL,

  -- Optional copies for lookup/debug; do not treat as source of truth.
  external_email text,

  -- Provider specific claims/attributes (sanitized)
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,

  CONSTRAINT fk_user_identities_user_id_users
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

  CONSTRAINT user_identities_provider_name_chk
    CHECK (length(provider_name) > 0),

  CONSTRAINT user_identities_external_user_id_chk
    CHECK (length(external_user_id) > 0)
);

-- Uniqueness per provider while supporting soft deletes.
CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_external_uq
  ON user_identities (provider_name, external_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx
  ON user_identities (user_id)
  WHERE deleted_at IS NULL;

-- 1.3 Password credentials (normalized)
-- Allows migration to Cognito/custom auth in parallel.
-- If Cognito is primary, this table can be unused for those users.
CREATE TABLE IF NOT EXISTS user_password_credentials (
  user_id uuid PRIMARY KEY,
  password_hash text NOT NULL,

  -- Optional metadata for future migrations (argon2/bcrypt), rotations, etc.
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

-- ============================================================================
-- 2) Audit & security event tables
-- ============================================================================

-- DESIGN: single append-only table with event_type + success + reason + details.
-- Benefits: one ingestion path, easy partitioning, consistent querying.
-- If you later want stricter schemas per event, add one-to-one detail tables.

CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Correlation
  request_id text,

  event_type security_event_type NOT NULL,

  -- Actor context (who did it)
  actor_user_id uuid,
  actor_system_role user_role,

  -- Target context (optional)
  target_user_id uuid,

  -- What/when/where/result
  action text NOT NULL,
  success boolean NOT NULL,
  failure_reason text,

  ip inet,
  user_agent text,

  -- Useful fields for auth/rbac investigations
  http_method text,
  http_path text,
  http_status_code integer,
  error_code text,

  -- Structured, sanitized detail payload
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

-- Optional: if you want guaranteed "append-only" semantics, enforce via permissions + no UPDATE/DELETE grants.

-- ============================================================================
-- 3) API request/response logging (DB-level)
-- ============================================================================

-- High write volume: use RANGE partitioning by time.
-- Store only SANITIZED metadata (no Authorization/Cookie, no tokens, no passwords, no raw bodies).
-- Recommended partition size: daily for very high volume, monthly for moderate.

CREATE TABLE IF NOT EXISTS api_request_logs (
  occurred_at timestamptz NOT NULL,
  id bigserial,

  request_id text NOT NULL,

  http_method text NOT NULL,
  http_path text NOT NULL,

  -- Optional, sanitized
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

-- Per-partition indexes: create on each partition (or use CREATE INDEX ON ONLY parent in PG 15+ with partitioned indexes).
-- Recommended indexes (per partition):
--   - (request_id)
--   - (authenticated_user_id, occurred_at DESC)
--   - (http_path, occurred_at DESC)
--   - (status_code, occurred_at DESC)
--   - (error_code, occurred_at DESC) WHERE error_code IS NOT NULL

-- Example partition (monthly). Create via automation (pg_cron or deploy-time DDL).
-- CREATE TABLE api_request_logs_2026_01 PARTITION OF api_request_logs
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
--
-- CREATE INDEX api_request_logs_2026_01_request_id_idx ON api_request_logs_2026_01 (request_id);
-- CREATE INDEX api_request_logs_2026_01_user_time_idx ON api_request_logs_2026_01 (authenticated_user_id, occurred_at DESC);
-- CREATE INDEX api_request_logs_2026_01_path_time_idx ON api_request_logs_2026_01 (http_path, occurred_at DESC);
-- CREATE INDEX api_request_logs_2026_01_status_time_idx ON api_request_logs_2026_01 (status_code, occurred_at DESC);
-- CREATE INDEX api_request_logs_2026_01_error_time_idx ON api_request_logs_2026_01 (error_code, occurred_at DESC) WHERE error_code IS NOT NULL;
--
-- For very large partitions, consider BRIN on occurred_at for cheap time scans:
-- CREATE INDEX api_request_logs_2026_01_occurred_at_brin ON api_request_logs_2026_01 USING brin (occurred_at);

COMMIT;
