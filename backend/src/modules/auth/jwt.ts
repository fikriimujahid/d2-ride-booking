import { SignJWT, jwtVerify, errors as JoseErrors } from 'jose';
import crypto from 'node:crypto';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';
import type { AuthenticatedUser, UserRole } from './types.js';

type AccessTokenClaims = {
  sub: string;
  role: UserRole;
  typ: 'access';
};

type RefreshTokenClaims = {
  sub: string;
  role: UserRole;
  typ: 'refresh';
  jti: string;
};

const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);
const refreshSecret = new TextEncoder().encode(env.jwtRefreshSecret);

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function hashToken(token: string): Buffer {
  return crypto.createHash('sha256').update(token).digest();
}

export async function signAccessToken(user: AuthenticatedUser): Promise<{ token: string; exp: number }> {
  const exp = nowSeconds() + env.jwtAccessTtlSeconds;
  const token = await new SignJWT({ role: user.role, typ: 'access' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(accessSecret);

  return { token, exp };
}

export async function signRefreshToken(user: AuthenticatedUser, jti: string): Promise<{ token: string; exp: number }>
{
  const exp = nowSeconds() + env.jwtRefreshTtlSeconds;
  const token = await new SignJWT({ role: user.role, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(refreshSecret);

  return { token, exp };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'access') {
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      throw new AppError('Invalid token payload', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (payload.role !== 'ADMIN' && payload.role !== 'DRIVER' && payload.role !== 'PASSENGER') {
      throw new AppError('Invalid token role', { statusCode: 401, code: 'UNAUTHORIZED' });
    }

    return { sub: payload.sub, role: payload.role, typ: 'access' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof JoseErrors.JWTExpired) {
      throw new AppError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED', cause: err });
    }
    throw new AppError('Invalid token', { statusCode: 401, code: 'UNAUTHORIZED', cause: err });
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'refresh') {
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.jti !== 'string') {
      throw new AppError('Invalid token payload', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (payload.role !== 'ADMIN' && payload.role !== 'DRIVER' && payload.role !== 'PASSENGER') {
      throw new AppError('Invalid token role', { statusCode: 401, code: 'UNAUTHORIZED' });
    }

    return { sub: payload.sub, role: payload.role, typ: 'refresh', jti: payload.jti };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof JoseErrors.JWTExpired) {
      throw new AppError('Refresh token expired', { statusCode: 401, code: 'TOKEN_EXPIRED', cause: err });
    }
    throw new AppError('Invalid refresh token', { statusCode: 401, code: 'UNAUTHORIZED', cause: err });
  }
}
