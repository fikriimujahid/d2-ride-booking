/**
 * Authentication Controller
 * 
 * Orchestrates HTTP request/response flow for authentication endpoints.
 * Responsibilities:
 * - Extract and validate request data
 * - Extract HTTP metadata (IP, user-agent)
 * - Call appropriate service methods
 * - Map service results to HTTP responses
 * 
 * Does NOT contain business logic or database access.
 */

import type { FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import {
  authenticateUserWithCredentials,
  createTotpSetupForAdmin,
  enableTotpForAdmin,
  exchangeMfaChallengeForTokens,
  listUserPermissions,
  refreshUserSession,
  revokeUserSession
} from './auth.service.js';
import type {
  Admin2faSetupResponse,
  Admin2faVerifyBody,
  AdminLoginResponse,
  AdminMfaRespondBody,
  LogoutBody,
  RefreshBody,
  RoleLoginBody,
  TokenResponse
} from './schemas.js';
import type { UserRole } from './types.js';
import { createUnauthorizedError } from './auth.errors.js';

/**
 * Request metadata extracted from Fastify request.
 */
export type RequestMeta = {
  ip?: string;
  userAgent?: string;
  requestId?: string;
  httpMethod?: string;
  httpPath?: string;
};

/**
 * Extract IP and user-agent from Fastify request.
 */
function extractRequestMeta(request: FastifyRequest): RequestMeta {
  const userAgent = request.headers['user-agent'];
  const requestIdHeader = request.headers['x-request-id'] ?? request.headers['x-correlation-id'];
  const requestId = typeof requestIdHeader === 'string' && requestIdHeader.trim() ? requestIdHeader.trim() : String(request.id);
  return {
    ip: request.ip,
    userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    requestId,
    httpMethod: request.method,
    httpPath: typeof request.raw.url === 'string' ? request.raw.url.split('?')[0] : undefined
  };
}

/**
 * Handle login for Admin role (returns 2FA setup or MFA challenge).
 */
export async function handleAdminLogin(
  db: Pool,
  request: FastifyRequest<{ Body: RoleLoginBody }>
): Promise<AdminLoginResponse> {
  const meta = extractRequestMeta(request);
  return await authenticateUserWithCredentials(db, 'ADMIN', request.body, meta);
}

/**
 * Handle login for Driver or Passenger role (returns tokens directly).
 */
export async function handleRoleLogin(
  db: Pool,
  role: Exclude<UserRole, 'ADMIN'>,
  request: FastifyRequest<{ Body: RoleLoginBody }>
): Promise<TokenResponse> {
  const meta = extractRequestMeta(request);
  return await authenticateUserWithCredentials(db, role, request.body, meta);
}

/**
 * Handle MFA challenge response for Admin.
 */
export async function handleAdminMfaResponse(
  db: Pool,
  request: FastifyRequest<{ Body: AdminMfaRespondBody }>
): Promise<TokenResponse> {
  const meta = extractRequestMeta(request);
  return await exchangeMfaChallengeForTokens(db, request.body, meta);
}

/**
 * Handle 2FA setup for Admin (requires setup token auth).
 */
export async function handleAdmin2faSetup(
  db: Pool,
  request: FastifyRequest
): Promise<Admin2faSetupResponse> {
  const userId = request.authUser?.userId;
  if (!userId) {
    throw createUnauthorizedError();
  }
  const meta = extractRequestMeta(request);
  return await createTotpSetupForAdmin(db, userId, meta);
}

/**
 * Handle 2FA verification for Admin (requires setup token auth).
 */
export async function handleAdmin2faVerify(
  db: Pool,
  request: FastifyRequest<{ Body: Admin2faVerifyBody }>
): Promise<TokenResponse> {
  const userId = request.authUser?.userId;
  if (!userId) {
    throw createUnauthorizedError();
  }
  const meta = extractRequestMeta(request);
  return await enableTotpForAdmin(db, userId, request.body, meta);
}

/**
 * Handle listing permissions for authenticated admin.
 */
export async function handleListPermissions(
  db: Pool,
  request: FastifyRequest
): Promise<{ permissions: string[] }> {
  const userId = request.authUser?.userId;
  if (!userId) {
    // Defensive: should be unreachable due to requireAuth middleware.
    throw createUnauthorizedError();
  }
  const permissions = await listUserPermissions(db, userId);
  return { permissions };
}

/**
 * Handle session refresh for any role.
 */
export async function handleRefreshSession(
  db: Pool,
  role: UserRole,
  request: FastifyRequest<{ Body: RefreshBody }>
): Promise<TokenResponse> {
  const meta = extractRequestMeta(request);
  return await refreshUserSession(db, role, request.body, meta);
}

/**
 * Handle logout (revoke refresh token).
 */
export async function handleLogout(
  db: Pool,
  request: FastifyRequest<{ Body: LogoutBody }>
): Promise<{ ok: boolean }> {
  const meta = extractRequestMeta(request);
  await revokeUserSession(db, request.body, meta);
  return { ok: true };
}
