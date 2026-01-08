import type { FastifyInstance, FastifyRequest } from 'fastify';
import { httpError } from '../util/httpErrors.js';
import type { AuthContext, UserType } from './types.js';

export function getBearerToken(req: FastifyRequest) {
  const auth = req.headers.authorization;
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1] : null;
}

export function enforceAdminOrigin(app: FastifyInstance, req: FastifyRequest) {
  const origin = req.headers.origin;
  if (!origin) throw httpError(403, 'Missing Origin header');
  if (!app.config.adminWebOrigins.includes(origin)) {
    throw httpError(403, 'Invalid Origin');
  }
}

export async function authenticateAccessToken(app: FastifyInstance, req: FastifyRequest, expected: { aud: string }) {
  const token = getBearerToken(req);
  if (!token) throw httpError(401, 'Missing bearer token');

  const payload = await app.jwt.verify(token, { aud: expected.aud, typ: 'access' });

  const userId = String(payload.sub ?? '');
  const userType = payload.ut as UserType | undefined;
  if (!userId || !userType) throw httpError(401, 'Invalid token');

  const ctx: AuthContext = {
    userId,
    userType,
    audience: expected.aud
  };

  (req as any).auth = ctx;
  return ctx;
}

export function requireUserType(req: FastifyRequest, type: UserType) {
  const auth = (req as any).auth as AuthContext | undefined;
  if (!auth) throw httpError(401, 'Missing auth');
  if (auth.userType !== type) throw httpError(403, 'Forbidden');
}

export function requirePermission(req: FastifyRequest, perm: string) {
  const auth = (req as any).auth as AuthContext | undefined;
  if (!auth) throw httpError(401, 'Missing auth');
  if (auth.userType !== 'ADMIN') throw httpError(403, 'Forbidden');
  // IMPORTANT: permissions must be loaded from DB by the route/middleware.
  // Frontend permission checks are UX only; backend must always enforce.
  if (!auth.permissions?.includes(perm)) throw httpError(403, 'Missing permission');
}

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}
