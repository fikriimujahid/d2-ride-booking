-- Auth schema (Modular Monolith)
-- Tables:
--  - users
--  - user_identities
--  - user_password_credentials
--  - refresh_tokens
--  - rbac_roles
--  - rbac_permissions
--  - rbac_role_permissions
--  - rbac_user_roles
--  - user_totp
--  - security_events
--  - api_request_logs (partitioned)

-- UUID generation
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('ADMIN', 'DRIVER', 'PASSENGER');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  role user_role NOT NULL,

  email text,
  phone text,

  password_hash text NOT NULL,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  last_login_at timestamptz,

  CONSTRAINT users_email_format_chk CHECK (email IS NULL OR position('@' in email) > 1),
  CONSTRAINT users_phone_format_chk CHECK (phone IS NULL OR phone ~ '^[0-9+][0-9]{6,20}$'),
  CONSTRAINT users_identifier_present_chk CHECK (email IS NOT NULL OR phone IS NOT NULL)
);

-- Role-scoped uniqueness: the same email/phone can exist in multiple roles if desired.
CREATE UNIQUE INDEX IF NOT EXISTS users_role_email_uq
  ON users (role, lower(email))
  WHERE email IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS users_role_phone_uq
  ON users (role, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- SHA-256 digest of the raw refresh token string.
  token_hash bytea NOT NULL,

  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES refresh_tokens(id) ON DELETE SET NULL,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  revoked_reason text,

  ip inet,
  user_agent text
);

CREATE UNIQUE INDEX IF NOT EXISTS refresh_tokens_token_hash_uq ON refresh_tokens (token_hash);
CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx ON refresh_tokens (user_id);
CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx ON refresh_tokens (expires_at);
CREATE INDEX IF NOT EXISTS refresh_tokens_revoked_at_idx ON refresh_tokens (revoked_at);

-- RBAC
CREATE TABLE IF NOT EXISTS rbac_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
  role_id uuid NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS rbac_user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  PRIMARY KEY (user_id, role_id)
);

CREATE INDEX IF NOT EXISTS rbac_user_roles_user_id_idx ON rbac_user_roles (user_id);
CREATE INDEX IF NOT EXISTS rbac_role_permissions_role_id_idx ON rbac_role_permissions (role_id);

-- Admin TOTP 2FA
CREATE TABLE IF NOT EXISTS user_totp (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc bytea NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- External identity provider mapping
CREATE TABLE IF NOT EXISTS user_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  external_user_id text NOT NULL,
  external_email text,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS user_identities_provider_external_uq
  ON user_identities (provider_name, external_user_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS user_identities_user_id_idx
  ON user_identities (user_id)
  WHERE deleted_at IS NULL;

-- Normalized password credentials (parallel IdP migration support)
CREATE TABLE IF NOT EXISTS user_password_credentials (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  password_algo text,
  password_updated_at timestamptz,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

-- Security / audit events
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
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_system_role user_role,
  target_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
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
  deleted_at timestamptz
);

-- API request/response logs (partitioned)
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
  authenticated_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  authenticated_system_role user_role,
  status_code integer NOT NULL,
  duration_ms integer NOT NULL,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occurred_at, id)
) PARTITION BY RANGE (occurred_at);

CREATE TABLE IF NOT EXISTS api_request_logs_default
  PARTITION OF api_request_logs DEFAULT;
