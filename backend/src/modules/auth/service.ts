import type { Pool } from 'pg';
import { AppError } from '../../shared/errors.js';
import type { RoleLoginBody, TokenResponse } from './schemas.js';
import type { AuthenticatedUser, UserRole } from './types.js';
import { verifyPassword } from './password.js';
import { hashToken, signAccessToken, signRefreshToken, verifyRefreshToken } from './jwt.js';
import crypto from 'node:crypto';

type UserRow = {
  id: string;
  role: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  email: string | null;
  phone: string | null;
  password_hash: string;
  is_active: boolean;
};

function isEmail(identifier: string): boolean {
  return identifier.includes('@') && identifier.length <= 320;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function validateRoleLoginInput(body: RoleLoginBody): void {
  const email = body.email.trim();
  if (!isEmail(email)) {
    throw new AppError('Login requires a valid email', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }
}

async function findUserForLogin(db: Pool, role: UserRole, input: RoleLoginBody): Promise<UserRow | null> {
  const email = normalizeEmail(input.email);
  const res = await db.query<UserRow>(
    'SELECT id, role, email, phone, password_hash, is_active FROM users WHERE role = $1 AND lower(email) = lower($2) LIMIT 1',
    [role, email]
  );
  return res.rows[0] ?? null;
}

function uuidV4(): string {
  // Node 18+ supports crypto.randomUUID
  return crypto.randomUUID();
}

export async function loginWithRole(
  db: Pool,
  role: UserRole,
  input: RoleLoginBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse>
{
  validateRoleLoginInput(input);

  const user = await findUserForLogin(db, role, input);
  const invalidError = new AppError('Invalid credentials', { statusCode: 401, code: 'INVALID_CREDENTIALS' });

  if (!user || !user.is_active) {
    // Avoid leaking existence or inactive status.
    throw invalidError;
  }

  const ok = await verifyPassword(input.password, user.password_hash);
  if (!ok) throw invalidError;

  const authUser: AuthenticatedUser = { userId: user.id, role: user.role };
  const refreshId = uuidV4();
  const { token: accessToken } = await signAccessToken(authUser);
  const { token: refreshToken, exp: refreshExp } = await signRefreshToken(authUser, refreshId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(refreshExp * 1000).toISOString();

  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, to_timestamp($4), $5::inet, $6)`,
    [refreshId, user.id, tokenHash, refreshExp, meta?.ip ?? null, meta?.userAgent ?? null]
  );

  return { accessToken, refreshToken, expiresAt };
}

export async function refreshWithRole(
  db: Pool,
  role: UserRole,
  input: { refreshToken: string },
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse>
{
  const claims = await verifyRefreshToken(input.refreshToken);
  if (claims.role !== role) {
    throw new AppError('Invalid refresh token', { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  // DB-backed revocation/rotation check
  const tokenHash = hashToken(input.refreshToken);
  const row = await db.query<{
    id: string;
    user_id: string;
    revoked_at: Date | null;
    expires_at: Date;
  }>(
    'SELECT id, user_id, revoked_at, expires_at FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
    [tokenHash]
  );

  const tokenRow = row.rows[0];
  if (!tokenRow) {
    throw new AppError('Invalid refresh token', { statusCode: 401, code: 'UNAUTHORIZED' });
  }
  if (tokenRow.revoked_at) {
    throw new AppError('Refresh token revoked', { statusCode: 401, code: 'UNAUTHORIZED' });
  }
  if (tokenRow.user_id !== claims.sub || tokenRow.id !== claims.jti) {
    throw new AppError('Refresh token mismatch', { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const refreshId = uuidV4();
  const authUser: AuthenticatedUser = { userId: claims.sub, role: claims.role };

  const { token: accessToken } = await signAccessToken(authUser);
  const { token: refreshToken, exp: refreshExp } = await signRefreshToken(authUser, refreshId);
  const newTokenHash = hashToken(refreshToken);

  const expiresAt = new Date(refreshExp * 1000).toISOString();

  await db.query('BEGIN');
  try {
    await db.query(
      'UPDATE refresh_tokens SET revoked_at = now(), replaced_by = $1 WHERE id = $2 AND revoked_at IS NULL',
      [refreshId, tokenRow.id]
    );

    await db.query(
      `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
       VALUES ($1, $2, $3, to_timestamp($4), $5::inet, $6)`,
      [refreshId, claims.sub, newTokenHash, refreshExp, meta?.ip ?? null, meta?.userAgent ?? null]
    );

    await db.query('COMMIT');
  } catch (err) {
    await db.query('ROLLBACK');
    throw err;
  }

  return { accessToken, refreshToken, expiresAt };
}

export async function logout(db: Pool, input: { refreshToken: string }): Promise<void> {
  // Best-effort: do not reveal whether it existed.
  let tokenHash: Buffer;
  try {
    tokenHash = hashToken(input.refreshToken);
  } catch {
    return;
  }

  await db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL', [tokenHash]);
}
