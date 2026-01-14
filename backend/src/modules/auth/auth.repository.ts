/**
 * Authentication Repository
 * 
 * Isolates all database access for authentication and authorization.
 * All SQL queries live here - no SQL in services or controllers.
 */

import type { Pool } from 'pg';
import type { PermissionCode, UserRole } from './types.js';

// Database row types
export type UserRow = {
  id: string;
  role: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  email: string | null;
  phone: string | null;
  password_hash: string;
  is_active: boolean;
};

export type UserTotpRow = {
  user_id: string;
  secret_enc: Buffer;
  enabled: boolean;
};

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  revoked_at: Date | null;
  expires_at: Date;
};

export type AdminActiveRow = {
  id: string;
  is_active: boolean;
};

/**
 * Find an active user by email and role.
 */
export async function findActiveUserByEmailAndRole(
  db: Pool,
  email: string,
  role: UserRole
): Promise<UserRow | null> {
  const res = await db.query<UserRow>(
    'SELECT id, role, email, phone, password_hash, is_active FROM users WHERE role = $1 AND lower(email) = lower($2) LIMIT 1',
    [role, email]
  );
  return res.rows[0] ?? null;
}

/**
 * Find admin by ID and check if active.
 */
export async function findAdminById(db: Pool, userId: string): Promise<AdminActiveRow | null> {
  const res = await db.query<AdminActiveRow>(
    'SELECT id, is_active FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    [userId, 'ADMIN']
  );
  return res.rows[0] ?? null;
}

/**
 * Get admin email by user ID.
 */
export async function getAdminEmail(db: Pool, userId: string): Promise<string | null> {
  const res = await db.query<{ email: string | null }>(
    'SELECT email FROM users WHERE id = $1 AND role = $2 LIMIT 1',
    [userId, 'ADMIN']
  );
  return res.rows[0]?.email ?? null;
}

/**
 * Get TOTP configuration for a user.
 */
export async function getUserTotpConfig(db: Pool, userId: string): Promise<UserTotpRow | null> {
  const res = await db.query<UserTotpRow>(
    'SELECT user_id, secret_enc, enabled FROM user_totp WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return res.rows[0] ?? null;
}

/**
 * Create or update TOTP secret for a user (not yet enabled).
 */
export async function upsertTotpSecret(db: Pool, userId: string, secretEnc: Buffer): Promise<void> {
  await db.query(
    `INSERT INTO user_totp (user_id, secret_enc, enabled)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id)
     DO UPDATE SET secret_enc = EXCLUDED.secret_enc, enabled = false, verified_at = NULL, updated_at = now()`,
    [userId, secretEnc]
  );
}

/**
 * Enable TOTP for a user (marks as verified).
 */
export async function enableUserTotp(db: Pool, userId: string): Promise<void> {
  await db.query(
    'UPDATE user_totp SET enabled = true, verified_at = now(), updated_at = now() WHERE user_id = $1',
    [userId]
  );
}

/**
 * Store a new refresh token in the database.
 */
export async function storeRefreshToken(
  db: Pool,
  refreshId: string,
  userId: string,
  tokenHash: Buffer,
  expiresAtSeconds: number,
  meta?: { ip?: string; userAgent?: string }
): Promise<void> {
  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, to_timestamp($4), $5::inet, $6)`,
    [refreshId, userId, tokenHash, expiresAtSeconds, meta?.ip ?? null, meta?.userAgent ?? null]
  );
}

/**
 * Find a refresh token by its hash.
 */
export async function findRefreshTokenByHash(db: Pool, tokenHash: Buffer): Promise<RefreshTokenRow | null> {
  const res = await db.query<RefreshTokenRow>(
    'SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
    [tokenHash]
  );
  return res.rows[0] ?? null;
}

/**
 * Revoke a refresh token and mark it as replaced.
 */
export async function revokeAndReplaceRefreshToken(
  db: Pool,
  oldTokenId: string,
  newRefreshId: string
): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2 AND revoked_at IS NULL',
    [newRefreshId, oldTokenId]
  );
}

/**
 * Revoke a refresh token by its hash (best-effort, for logout).
 */
export async function revokeRefreshTokenByHash(db: Pool, tokenHash: Buffer): Promise<void> {
  await db.query(
    'UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL',
    [tokenHash]
  );
}

/**
 * List all permissions for a user (via RBAC role assignments).
 */
export async function listPermissionsForUser(db: Pool, userId: string): Promise<PermissionCode[]> {
  const res = await db.query<{ code: PermissionCode }>(
    `SELECT DISTINCT p.code
     FROM rbac_permissions p
     JOIN rbac_role_permissions rp ON rp.permission_id = p.id
     JOIN rbac_user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1
     ORDER BY p.code ASC`,
    [userId]
  );
  return res.rows.map((r) => r.code);
}

/**
 * Check if a user has a specific permission.
 */
export async function checkUserHasPermission(
  db: Pool,
  userId: string,
  permission: PermissionCode
): Promise<boolean> {
  const res = await db.query<{ ok: number }>(
    `SELECT 1 as ok
     FROM rbac_permissions p
     JOIN rbac_role_permissions rp ON rp.permission_id = p.id
     JOIN rbac_user_roles ur ON ur.role_id = rp.role_id
     WHERE ur.user_id = $1 AND p.code = $2
     LIMIT 1`,
    [userId, permission]
  );
  return (res.rows[0]?.ok ?? 0) === 1;
}

/**
 * Execute a database transaction with the provided callback.
 */
export async function executeTransaction<T>(db: Pool, callback: () => Promise<T>): Promise<T> {
  await db.query('BEGIN');
  try {
    const result = await callback();
    await db.query('COMMIT');
    return result;
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }
}
