import type { FastifyReply, FastifyRequest } from 'fastify';
import { verifyAccessToken, verifyTotpSetupToken } from './jwt.js';
import type { AuthenticatedUser, PermissionCode, UserRole } from './types.js';
import { userHasPermission } from './auth.service.js';
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
    throw createUnauthorizedError('Missing Authorization header');
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw createUnauthorizedError('Missing bearer token');
  }

  const claims = await verifyAccessToken(token);
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
    request.authUser = await authenticateRequest(request);
  };
}

export function requireRole(roles: readonly UserRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply) => {
    const user = request.authUser ?? (await authenticateRequest(request));
    request.authUser = user;
    if (!roles.includes(user.role)) {
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
      throw createForbiddenError();
    }

    const ok = await userHasPermission(request.server.db, user.userId, permission);
    if (!ok) {
      throw createInsufficientPermissionsError();
    }
  };
}
