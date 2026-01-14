/**
 * Authentication Service
 * 
 * Contains core business logic for authentication and authorization.
 * 
 * Authentication Flow:
 * 1. Validate user credentials (email + password)
 * 2. Check if user is active
 * 3. For Admin: check 2FA enrollment status
 *    - Not enrolled → return setup token
 *    - Enrolled → return MFA challenge session
 * 4. For Driver/Passenger: issue tokens directly
 * 
 * Authorization Flow:
 * 1. Validate JWT token
 * 2. Check user permissions via RBAC
 * 3. Enforce role + permission requirements
 * 
 * Delegates:
 * - Database access → auth.repository.ts
 * - HTTP concerns → auth.controller.ts
 * - JWT operations → jwt.ts
 * - Password hashing → password.ts
 * - TOTP operations → totp.ts
 */

import type { Pool } from 'pg';
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
import {
  checkUserHasPermission,
  enableUserTotp,
  executeTransaction,
  findActiveUserByEmailAndRole,
  findAdminById,
  findRefreshTokenByHash,
  getAdminEmail,
  getUserTotpConfig,
  listPermissionsForUser,
  revokeAndReplaceRefreshToken,
  revokeRefreshTokenByHash,
  storeRefreshToken,
  upsertTotpSecret
} from './auth.repository.js';
import {
  createAdmin2faSetupRequiredError,
  createAuthConfigError,
  createConflictError,
  createInvalidCredentialsError,
  createInvalidOtpError,
  createUnauthorizedError,
  createValidationError
} from './auth.errors.js';

export type RequestMeta = {
  ip?: string;
  userAgent?: string;
};

// ========================================
// Input Validation
// ========================================

function isEmail(identifier: string): boolean {
  return identifier.includes('@') && identifier.length <= 320;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Validate login input (email format, OTP format if provided).
 */
export function validateLoginInput(body: RoleLoginBody): void {
  const email = body.email.trim();
  if (!isEmail(email)) {
    throw createValidationError('Login requires a valid email');
  }

  if (typeof body.otp === 'string' && body.otp.length > 0 && !/^[0-9]{6}$/.test(body.otp)) {
    throw createValidationError('Invalid OTP format');
  }
}

// ========================================
// Token Issuance
// ========================================

function generateTokenId(): string {
  return crypto.randomUUID();
}

/**
 * Issue access + refresh tokens for authenticated user.
 * Stores refresh token in database for revocation/rotation.
 */
async function issueTokenPair(
  db: Pool,
  authUser: AuthenticatedUser,
  meta?: RequestMeta
): Promise<TokenResponse> {
  const refreshId = generateTokenId();
  const { token: accessToken } = await signAccessToken(authUser);
  const { token: refreshToken, exp: refreshExp } = await signRefreshToken(authUser, refreshId);

  const tokenHash = hashToken(refreshToken);
  const expiresAt = new Date(refreshExp * 1000).toISOString();

  await storeRefreshToken(db, refreshId, authUser.userId, tokenHash, refreshExp, meta);

  return { accessToken, refreshToken, expiresAt };
}

// ========================================
// TOTP / 2FA Helpers
// ========================================

/**
 * Verify that admin has enabled TOTP and the provided OTP is valid.
 * Throws if TOTP not enabled or OTP invalid.
 */
async function verifyAdminTotpCode(db: Pool, userId: string, otp: string): Promise<void> {
  const totp = await getUserTotpConfig(db, userId);
  if (!totp || !totp.enabled) {
    throw createAdmin2faSetupRequiredError();
  }

  if (!/^[0-9]{6}$/.test(otp)) {
    throw createValidationError('Invalid OTP format');
  }

  const secretBase32 = decryptTotpSecret(totp.secret_enc);
  const isValid = verifyTotpCode(secretBase32, otp);
  if (!isValid) {
    throw createInvalidOtpError();
  }
}

// ========================================
// Authentication: Login
// ========================================

/**
 * Authenticate user with email + password.
 * 
 * For Admin:
 * - If 2FA not enrolled → return setup token
 * - If 2FA enrolled → return MFA challenge session
 * 
 * For Driver/Passenger:
 * - Return access + refresh tokens directly
 */
export async function authenticateUserWithCredentials(
  db: Pool,
  role: 'ADMIN',
  input: RoleLoginBody,
  meta?: RequestMeta
): Promise<Admin2faSetupRequiredResponse | AdminMfaChallengeResponse>
export async function authenticateUserWithCredentials(
  db: Pool,
  role: Exclude<UserRole, 'ADMIN'>,
  input: RoleLoginBody,
  meta?: RequestMeta
): Promise<TokenResponse>
export async function authenticateUserWithCredentials(
  db: Pool,
  role: UserRole,
  input: RoleLoginBody,
  meta?: RequestMeta
): Promise<TokenResponse | Admin2faSetupRequiredResponse | AdminMfaChallengeResponse>
{
  validateLoginInput(input);

  const email = normalizeEmail(input.email);
  const user = await findActiveUserByEmailAndRole(db, email, role);

  // Use generic error to avoid leaking user existence or inactive status
  if (!user || !user.is_active) {
    throw createInvalidCredentialsError();
  }

  const passwordValid = await verifyPassword(input.password, user.password_hash);
  if (!passwordValid) {
    throw createInvalidCredentialsError();
  }

  const authUser: AuthenticatedUser = { userId: user.id, role: user.role };

  // Admin-specific: check 2FA enrollment
  if (role === 'ADMIN') {
    const totp = await getUserTotpConfig(db, user.id);
    
    if (!totp || !totp.enabled) {
      // 2FA not enrolled - return setup token
      const { token: setupToken, exp } = await signTotpSetupToken(authUser);
      return { 
        twoFactorRequired: true, 
        setupToken, 
        expiresAt: new Date(exp * 1000).toISOString() 
      };
    }

    // 2FA enrolled - return MFA challenge (Cognito-style)
    const { token: session, exp } = await signMfaChallengeToken(authUser);
    return { 
      challengeName: 'SOFTWARE_TOKEN_MFA', 
      session, 
      expiresAt: new Date(exp * 1000).toISOString() 
    };
  }

  // Driver/Passenger: issue tokens directly
  return await issueTokenPair(db, authUser, meta);
}

// ========================================
// Authentication: MFA Challenge Response
// ========================================

/**
 * Exchange MFA challenge session + OTP for access/refresh tokens.
 * Verifies the challenge token and validates the TOTP code.
 */
export async function exchangeMfaChallengeForTokens(
  db: Pool,
  input: AdminMfaRespondBody,
  meta?: RequestMeta
): Promise<TokenResponse> {
  const claims = await verifyMfaChallengeToken(input.session);

  const admin = await findAdminById(db, claims.sub);
  if (!admin || !admin.is_active) {
    throw createUnauthorizedError();
  }

  await verifyAdminTotpCode(db, claims.sub, input.otp);
  return await issueTokenPair(db, { userId: claims.sub, role: 'ADMIN' }, meta);
}

// ========================================
// 2FA Setup & Verification
// ========================================

/**
 * Create TOTP setup for admin (generate secret, QR code).
 * Requires admin to have email configured.
 */
export async function createTotpSetupForAdmin(db: Pool, userId: string): Promise<Admin2faSetupResponse> {
  const email = await getAdminEmail(db, userId);
  if (!email) {
    throw createAuthConfigError('Admin must have email for TOTP');
  }

  const existing = await getUserTotpConfig(db, userId);
  if (existing?.enabled) {
    throw createConflictError('2FA already enabled');
  }

  const setup = await createTotpSetup(email);
  const secretEnc = encryptTotpSecret(setup.secretBase32);

  await upsertTotpSecret(db, userId, secretEnc);

  return setup;
}

/**
 * Verify TOTP code and enable 2FA for admin.
 * Returns access + refresh tokens upon successful verification.
 */
export async function enableTotpForAdmin(
  db: Pool,
  userId: string,
  input: Admin2faVerifyBody,
  meta?: RequestMeta
): Promise<TokenResponse> {
  if (!/^[0-9]{6}$/.test(input.otp)) {
    throw createValidationError('Invalid OTP format');
  }

  const totp = await getUserTotpConfig(db, userId);
  if (!totp) {
    throw createAdmin2faSetupRequiredError();
  }
  if (totp.enabled) {
    throw createConflictError('2FA already enabled');
  }

  const secretBase32 = decryptTotpSecret(totp.secret_enc);
  const isValid = verifyTotpCode(secretBase32, input.otp);
  if (!isValid) {
    throw createInvalidOtpError();
  }

  await enableUserTotp(db, userId);

  return await issueTokenPair(db, { userId, role: 'ADMIN' }, meta);
}

// ========================================
// Authorization: Permissions
// ========================================

/**
 * List all permissions for a user (via RBAC).
 */
export async function listUserPermissions(db: Pool, userId: string): Promise<PermissionCode[]> {
  return await listPermissionsForUser(db, userId);
}

/**
 * Check if user has a specific permission.
 */
export async function userHasPermission(db: Pool, userId: string, permission: PermissionCode): Promise<boolean> {
  return await checkUserHasPermission(db, userId, permission);
}

// ========================================
// Session Management: Refresh & Logout
// ========================================

/**
 * Refresh user session: validate refresh token, issue new token pair.
 * Implements token rotation (old token revoked, new token issued).
 */
export async function refreshUserSession(
  db: Pool,
  role: UserRole,
  input: { refreshToken: string },
  meta?: RequestMeta
): Promise<TokenResponse> {
  const claims = await verifyRefreshToken(input.refreshToken);
  
  if (claims.role !== role) {
    throw createUnauthorizedError('Invalid refresh token');
  }

  const tokenHash = hashToken(input.refreshToken);
  const tokenRow = await findRefreshTokenByHash(db, tokenHash);

  if (!tokenRow) {
    throw createUnauthorizedError('Invalid refresh token');
  }
  if (tokenRow.revoked_at) {
    throw createUnauthorizedError('Refresh token revoked');
  }
  if (tokenRow.user_id !== claims.sub || tokenRow.id !== claims.jti) {
    throw createUnauthorizedError('Refresh token mismatch');
  }

  const refreshId = generateTokenId();
  const authUser: AuthenticatedUser = { userId: claims.sub, role: claims.role };

  const { token: accessToken } = await signAccessToken(authUser);
  const { token: refreshToken, exp: refreshExp } = await signRefreshToken(authUser, refreshId);
  const newTokenHash = hashToken(refreshToken);
  const expiresAt = new Date(refreshExp * 1000).toISOString();

  // Token rotation: revoke old, store new
  await executeTransaction(db, async () => {
    await revokeAndReplaceRefreshToken(db, tokenRow.id, refreshId);
    await storeRefreshToken(db, refreshId, claims.sub, newTokenHash, refreshExp, meta);
  });

  return { accessToken, refreshToken, expiresAt };
}

/**
 * Revoke user session (logout).
 * Best-effort: does not reveal whether token existed.
 */
export async function revokeUserSession(db: Pool, input: { refreshToken: string }): Promise<void> {
  let tokenHash: Buffer;
  try {
    tokenHash = hashToken(input.refreshToken);
  } catch {
    // Invalid token format - fail silently
    return;
  }

  await revokeRefreshTokenByHash(db, tokenHash);
}
