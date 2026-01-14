import type { Pool } from 'pg';
import { AppError } from '../../shared/errors.js';
import type {
  Admin2faSetupRequiredResponse,
  Admin2faSetupResponse,
  Admin2faVerifyBody,
  AdminMfaChallengeResponse,
  AdminMfaRespondBody,
  RoleLoginBody,
  TokenResponse
} from './schemas.js';
import type { AuthenticatedUser, PermissionCode, UserRole } from './types.js';
import { verifyPassword } from './password.js';
import {
  hashToken,
  signAccessToken,
  signMfaChallengeToken,
  signRefreshToken,
  signTotpSetupToken,
  verifyMfaChallengeToken,
  verifyRefreshToken
} from './jwt.js';
import crypto from 'node:crypto';
import { createTotpSetup, decryptTotpSecret, encryptTotpSecret, verifyTotpCode } from './totp.js';

type UserRow = {
  id: string;
  role: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  email: string | null;
  phone: string | null;
  password_hash: string;
  is_active: boolean;
};

type UserTotpRow = {
  user_id: string;
  secret_enc: Buffer;
  enabled: boolean;
};

type AdminActiveRow = {
  id: string;
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

  if (typeof body.otp === 'string' && body.otp.length > 0 && !/^[0-9]{6}$/.test(body.otp)) {
    throw new AppError('Invalid OTP format', { statusCode: 400, code: 'VALIDATION_ERROR' });
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

async function getUserTotp(db: Pool, userId: string): Promise<UserTotpRow | null> {
  const res = await db.query<UserTotpRow>('SELECT user_id, secret_enc, enabled FROM user_totp WHERE user_id = $1 LIMIT 1', [userId]);
  return res.rows[0] ?? null;
}

async function verifyEnabledAdminTotp(db: Pool, userId: string, otp: string): Promise<void> {
  const totp = await getUserTotp(db, userId);
  if (!totp || !totp.enabled) {
    throw new AppError('Admin 2FA setup required', { statusCode: 428, code: 'ADMIN_2FA_SETUP_REQUIRED' });
  }

  if (!/^[0-9]{6}$/.test(otp)) {
    throw new AppError('Invalid OTP format', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const secretBase32 = decryptTotpSecret(totp.secret_enc);
  const ok = verifyTotpCode(secretBase32, otp);
  if (!ok) {
    throw new AppError('Invalid OTP', { statusCode: 401, code: 'INVALID_OTP' });
  }
}

function uuidV4(): string {
  // Node 18+ supports crypto.randomUUID
  return crypto.randomUUID();
}

async function issueTokens(
  db: Pool,
  authUser: AuthenticatedUser,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse> {
  const refreshId = uuidV4();
  const { token: accessToken } = await signAccessToken(authUser);
  const { token: refreshToken, exp: refreshExp } = await signRefreshToken(authUser, refreshId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(refreshExp * 1000).toISOString();

  await db.query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, ip, user_agent)
     VALUES ($1, $2, $3, to_timestamp($4), $5::inet, $6)`,
    [refreshId, authUser.userId, tokenHash, refreshExp, meta?.ip ?? null, meta?.userAgent ?? null]
  );

  return { accessToken, refreshToken, expiresAt };
}

export async function loginWithRole(
  db: Pool,
  role: 'ADMIN',
  input: RoleLoginBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<Admin2faSetupRequiredResponse | AdminMfaChallengeResponse>
export async function loginWithRole(
  db: Pool,
  role: Exclude<UserRole, 'ADMIN'>,
  input: RoleLoginBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse>
export async function loginWithRole(
  db: Pool,
  role: UserRole,
  input: RoleLoginBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse | Admin2faSetupRequiredResponse | AdminMfaChallengeResponse>
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

  if (role === 'ADMIN') {
    const totp = await getUserTotp(db, user.id);
    if (!totp || !totp.enabled) {
      const { token: setupToken, exp } = await signTotpSetupToken(authUser);
      return { twoFactorRequired: true, setupToken, expiresAt: new Date(exp * 1000).toISOString() };
    }

    // Cognito-style: when MFA is enabled, login returns a challenge session.
    const { token: session, exp } = await signMfaChallengeToken(authUser);
    return { challengeName: 'SOFTWARE_TOKEN_MFA', session, expiresAt: new Date(exp * 1000).toISOString() };
  }

  return await issueTokens(db, authUser, meta);
}

export async function admin2faSetup(db: Pool, userId: string): Promise<Admin2faSetupResponse> {
  const res = await db.query<{ email: string | null }>('SELECT email FROM users WHERE id = $1 AND role = $2 LIMIT 1', [
    userId,
    'ADMIN'
  ]);
  const email = res.rows[0]?.email ?? null;
  if (!email) {
    throw new AppError('Admin must have email for TOTP', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  const existing = await getUserTotp(db, userId);
  if (existing?.enabled) {
    throw new AppError('2FA already enabled', { statusCode: 409, code: 'VALIDATION_ERROR' });
  }

  const setup = await createTotpSetup(email);
  const secretEnc = encryptTotpSecret(setup.secretBase32);

  await db.query(
    `INSERT INTO user_totp (user_id, secret_enc, enabled)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id)
     DO UPDATE SET secret_enc = EXCLUDED.secret_enc, enabled = false, verified_at = NULL, updated_at = now()`,
    [userId, secretEnc]
  );

  return setup;
}

export async function adminRespondToMfaChallenge(
  db: Pool,
  input: AdminMfaRespondBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse> {
  const claims = await verifyMfaChallengeToken(input.session);

  const adminRes = await db.query<AdminActiveRow>('SELECT id, is_active FROM users WHERE id = $1 AND role = $2 LIMIT 1', [
    claims.sub,
    'ADMIN'
  ]);
  const admin = adminRes.rows[0];
  if (!admin || !admin.is_active) {
    throw new AppError('Unauthorized', { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  await verifyEnabledAdminTotp(db, claims.sub, input.otp);
  return await issueTokens(db, { userId: claims.sub, role: 'ADMIN' }, meta);
}

export async function admin2faVerify(
  db: Pool,
  userId: string,
  input: Admin2faVerifyBody,
  meta?: { ip?: string; userAgent?: string }
): Promise<TokenResponse> {
  if (!/^[0-9]{6}$/.test(input.otp)) {
    throw new AppError('Invalid OTP format', { statusCode: 400, code: 'VALIDATION_ERROR' });
  }

  const totp = await getUserTotp(db, userId);
  if (!totp) {
    throw new AppError('Admin 2FA setup required', { statusCode: 428, code: 'ADMIN_2FA_SETUP_REQUIRED' });
  }
  if (totp.enabled) {
    throw new AppError('2FA already enabled', { statusCode: 409, code: 'VALIDATION_ERROR' });
  }

  const secretBase32 = decryptTotpSecret(totp.secret_enc);
  const otpOk = verifyTotpCode(secretBase32, input.otp);
  if (!otpOk) {
    throw new AppError('Invalid OTP', { statusCode: 401, code: 'INVALID_OTP' });
  }

  await db.query('UPDATE user_totp SET enabled = true, verified_at = now(), updated_at = now() WHERE user_id = $1', [
    userId
  ]);

  return await issueTokens(db, { userId, role: 'ADMIN' }, meta);
}

export async function listUserPermissions(db: Pool, userId: string): Promise<PermissionCode[]> {
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

export async function userHasPermission(db: Pool, userId: string, permission: PermissionCode): Promise<boolean> {
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
