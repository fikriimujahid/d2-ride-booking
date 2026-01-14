-- 002_rbac_admin_2fa.sql
-- Adds Admin RBAC tables (roles + permissions) and Admin TOTP 2FA storage.

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
-- Stores encrypted base32 secret for TOTP. Encryption key is provided by env and handled in app code.
CREATE TABLE IF NOT EXISTS user_totp (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret_enc bytea NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed baseline Admin permissions and a default role.
INSERT INTO rbac_permissions (code, description)
VALUES
  ('admin:rbac:read', 'Read RBAC configuration'),
  ('admin:rbac:write', 'Modify RBAC configuration'),
  ('admin:users:read', 'Read users'),
  ('admin:users:write', 'Modify users')
ON CONFLICT (code) DO NOTHING;

INSERT INTO rbac_roles (name, description)
VALUES ('ADMIN_SUPER', 'Full admin access')
ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description;

-- Grant all currently-seeded permissions to ADMIN_SUPER.
INSERT INTO rbac_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM rbac_roles r
JOIN rbac_permissions p ON TRUE
WHERE r.name = 'ADMIN_SUPER'
ON CONFLICT DO NOTHING;
