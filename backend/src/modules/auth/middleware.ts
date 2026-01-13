import type { FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from '../../shared/errors.js';
import { verifyAccessToken } from './jwt.js';
import type { AuthenticatedUser, UserRole } from './types.js';

declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthenticatedUser;
  }
}

export async function authenticateRequest(request: FastifyRequest): Promise<AuthenticatedUser> {
  const header = request.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AppError('Missing Authorization header', { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const token = header.slice('Bearer '.length).trim();
  if (!token) {
    throw new AppError('Missing bearer token', { statusCode: 401, code: 'UNAUTHORIZED' });
  }

  const claims = await verifyAccessToken(token);
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
      throw new AppError('Forbidden', { statusCode: 403, code: 'FORBIDDEN' });
    }
  };
}
