import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, verifyTotpSetupToken } from './jwt.js';
import type { AuthenticatedUser, PermissionCode, UserRole } from './types.js';
import { userHasPermission } from './auth.service.js';
import { tryInsertSecurityEvent } from '../../shared/security-events.js';
import {
  createForbiddenError,
  createInsufficientPermissionsError,
  createUnauthorizedError
} from './auth.errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

export async function authenticateRequest(request: FastifyRequest): Promise<AuthenticatedUser> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    // Why: we only accept bearer tokens; prevents accidental support for insecure schemes.
    throw createUnauthorizedError('Missing Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw createUnauthorizedError('Missing bearer token');
  }

  // This verifies signature + expiry + claim types.
  // If removed: any string could be treated as an authenticated identity.
  const claims = await verifyAccessToken(token);

  // Request-scoped user context used by downstream route handlers and RBAC checks.
  // If removed: each handler would need to re-parse JWT (duplicated logic, inconsistent behavior).
  return { userId: claims.sub, role: claims.role };
}

export async function authenticateTotpSetupRequest(request: FastifyRequest): Promise<AuthenticatedUser> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw createUnauthorizedError('Missing Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw createUnauthorizedError('Missing bearer token');
  }

  const claims = await verifyTotpSetupToken(token);
  return { userId: claims.sub, role: claims.role };
}

export function requireAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    // Middleware-based authorization: run before handlers.
    // If removed: endpoints would execute without an authenticated identity.
    request.authUser = await authenticateRequest(request);
  };
}

export function requireRole(roles: readonly UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.authUser ?? (await authenticateRequest(request));
    request.authUser = user;
    if (!roles.includes(user.role)) {
      // Why: role is a coarse-grained boundary (ADMIN vs DRIVER vs PASSENGER).
      // If removed: non-admin callers could access admin endpoints.
      throw createForbiddenError();
    }
  };
}

export function requireTotpSetupAuth() {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    request.authUser = await authenticateTotpSetupRequest(request);
  };
}

export function requirePermission(permission: PermissionCode) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.authUser ?? (await authenticateRequest(request));
    request.authUser = user;

    // Admin RBAC only. Driver/Passenger auth remains role-scoped.
    if (user.role !== 'ADMIN') {
      // Why: permissions are defined only for admins.
      // If removed: we'd mix two authorization models and risk granting unintended access.
      throw createForbiddenError();
    }

    const ok = await userHasPermission(request.server.db, user.userId, permission);
    if (!ok) {
      // Why: permission denials are security events (auditability + detection).
      await tryInsertSecurityEvent(request.server.db, {
        requestId: (request as FastifyRequest & { auditRequestId?: string }).auditRequestId ?? String(request.id),
        eventType: 'auth.permission_denied',
        actorUserId: user.userId,
        actorSystemRole: user.role,
        action: 'permission_denied',
        success: false,
        failureReason: 'INSUFFICIENT_PERMISSIONS',
        ip: request.ip,
        userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
        httpMethod: request.method,
        httpPath: typeof request.raw.url === 'string' ? request.raw.url.split('?')[0] : undefined,
        httpStatusCode: 403,
        errorCode: 'INSUFFICIENT_PERMISSIONS',
        details: { requiredPermission: permission }
      });
      throw createInsufficientPermissionsError();
    }
  };
}
