import type { RequestHandler } from 'express';
import { jwtVerify } from 'jose';
import { z } from 'zod';

import { env } from '../../config/env';
import type { AuthContext } from './auth.types';

const tokenPayloadSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(['admin', 'driver', 'passenger']),
});

function getBearerToken(headerValue: string | undefined): string | undefined {
  if (!headerValue) return undefined;
  const match = headerValue.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function verifyToken(token: string): Promise<AuthContext> {
  if (!env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set; cannot verify JWTs.');
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);

  const { payload } = await jwtVerify(token, secret, {
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  });

  const parsed = tokenPayloadSchema.parse(payload);

  return {
    userId: parsed.sub,
    role: parsed.role,
  };
}

/**
 * Parses and verifies a JWT if present.
 * - If valid: sets `req.auth`.
 * - If missing: leaves request unauthenticated.
 * - If invalid: responds 401.
 */
export function authenticateJwtOptional(): RequestHandler {
  return async (req, res, next) => {
    try {
      const token = getBearerToken(req.header('authorization'));
      if (!token) return next();

      req.auth = await verifyToken(token);
      return next();
    } catch {
      return res.status(401).json({ error: 'unauthorized' });
    }
  };
}

/**
 * Requires a previously authenticated request (typically after authenticateJwtOptional).
 */
export function requireAuth(): RequestHandler {
  return (req, res, next) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    return next();
  };
}
