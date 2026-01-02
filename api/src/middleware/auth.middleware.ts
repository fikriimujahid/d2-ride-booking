import type { RequestHandler } from 'express';
import { UnauthorizedError } from '../models/error.model.js';
import { verifyCognitoJwt } from '../utils/jwt.util.js';
import type { SystemGroup } from '../models/auth.model.js';

function parseBearerToken(headerValue: string | undefined): string | null {
  if (!headerValue) return null;
  const [scheme, token] = headerValue.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

function normalizeGroups(value: unknown): SystemGroup[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((g) => typeof g === 'string')
    .filter((g): g is SystemGroup => g === 'Admin' || g === 'Passenger' || g === 'Driver');
}

function normalizeAmr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v) => typeof v === 'string');
}

export const authenticateJwt: RequestHandler = async (req, _res, next) => {
  try {
    const token = parseBearerToken(req.header('authorization'));
    if (!token) throw new UnauthorizedError('MISSING_BEARER_TOKEN');

    const { claims } = await verifyCognitoJwt(token);

    const sub = claims.sub;
    if (typeof sub !== 'string' || !sub) throw new UnauthorizedError('INVALID_TOKEN');

    const tokenUse = claims.token_use;
    if (tokenUse !== 'access' && tokenUse !== 'id') throw new UnauthorizedError('INVALID_TOKEN_USE');

    const email = typeof claims.email === 'string' ? claims.email : undefined;
    const groups = normalizeGroups(claims['cognito:groups']);
    const amr = normalizeAmr(claims.amr);

    req.auth = {
      sub,
      email,
      tokenUse,
      groups,
      amr,
      rawClaims: claims
    };

    next();
  } catch (err) {
    next(err);
  }
};
