import type { FastifyInstance, FastifyRequest } from 'fastify';
import { httpError } from '../util/httpErrors.js';

export type AuthRole = 'passenger' | 'driver' | 'admin' | 'system' | 'anonymous';

export type AuthContext = {
  subjectId: string;
  role: Exclude<AuthRole, 'anonymous'>;
  scopes: string[];
};

export type AuthContextResolver = {
  resolve(req: FastifyRequest): Promise<AuthContext | null>;
};

export function parseAuthContextFromHeaders(headers: FastifyRequest['headers']): AuthContext | null {
  const subjectId = headerValue(headers, 'x-auth-sub');
  const role = (headerValue(headers, 'x-auth-role') ?? 'anonymous') as AuthRole;
  const scopesRaw = headerValue(headers, 'x-auth-scopes');
  const scopes = scopesRaw ? scopesRaw.split(',').map((s) => s.trim()).filter(Boolean) : [];

  if (!subjectId || role === 'anonymous') return null;
  if (role !== 'passenger' && role !== 'driver' && role !== 'admin' && role !== 'system') return null;

  return { subjectId, role, scopes };
}

class HeaderAuthContextResolver implements AuthContextResolver {
  async resolve(req: FastifyRequest): Promise<AuthContext | null> {
    // Dev-friendly: pass identity via headers.
    // Controllers only see req.auth, never how it was derived.
    return parseAuthContextFromHeaders(req.headers);
  }
}

function headerValue(headers: FastifyRequest['headers'], name: string): string | undefined {
  const record = headers as Record<string, string | string[] | undefined>;
  const value = record[name] ?? record[name.toLowerCase()];
  if (Array.isArray(value)) return value[0];
  if (typeof value === 'string') return value;
  return undefined;
}

export async function registerAuthContext(app: FastifyInstance) {
  const resolver: AuthContextResolver =
    app.config.authContextMode === 'headers'
      ? new HeaderAuthContextResolver()
      : { resolve: async () => null };

  app.decorateRequest('auth', null);

  app.addHook('preHandler', async (req) => {
    const ctx = await resolver.resolve(req);
    req.auth = ctx;
  });
}

export function requireAuth(req: FastifyRequest): AuthContext {
  if (!req.auth) throw httpError(401, 'UNAUTHORIZED', 'Authentication required');
  return req.auth;
}

export function requireRole(req: FastifyRequest, role: Exclude<AuthRole, 'anonymous'>): AuthContext {
  const auth = requireAuth(req);
  if (auth.role !== role) throw httpError(403, 'FORBIDDEN', 'Forbidden');
  return auth;
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext | null;
  }
}
