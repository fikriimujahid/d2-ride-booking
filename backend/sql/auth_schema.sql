-- Auth schema (Modular Monolith)
-- Tables:
--  - users
--  - refresh_tokens
--  - rbac_roles
--  - rbac_permissions
--  - rbac_role_permissions
--  - rbac_user_roles
--  - user_totp

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
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rbac_role_permissions (
  role_id uuid NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES rbac_permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS rbac_user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
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
  updated_at timestamptz NOT NULL DEFAULT now()
);
