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

type TotpSetupTokenClaims = {
  sub: string;
  role: 'ADMIN';
  typ: 'totp_setup';
};

type MfaChallengeTokenClaims = {
  sub: string;
  role: 'ADMIN';
  typ: 'mfa_challenge';
};

const accessSecret = new TextEncoder().encode(env.jwtAccessSecret);
const refreshSecret = new TextEncoder().encode(env.jwtRefreshSecret);

// Why two secrets: access and refresh tokens have different risk profiles.
// If removed (single secret): compromising one token class compromises both, weakening containment.

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

export function hashToken(token: string): Buffer {
  // Why: we store only a hash of the refresh token in DB.
  // If DB leaks, attackers can't directly replay refresh tokens from stored hashes.
  return crypto.createHash('sha256').update(token).digest();
}

export async function signAccessToken(user: AuthenticatedUser): Promise<{ token: string; exp: number }> {
  const exp = nowSeconds() + env.jwtAccessTtlSeconds;
  // Access token contains only minimal claims:
  // - sub (user id)
  // - role (system role)
  // - typ (token type)
  // Why: keep JWT small, and avoid placing mutable authorization data in tokens.
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
  // Refresh token includes a unique ID (jti) so we can rotate/revoke server-side.
  // If removed: refresh tokens become non-revocable (stateless) and logout/revocation stops working.
  const token = await new SignJWT({ role: user.role, typ: 'refresh' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.userId)
    .setJti(jti)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(refreshSecret);

  return { token, exp };
}

export async function signTotpSetupToken(user: AuthenticatedUser): Promise<{ token: string; exp: number }> {
  if (user.role !== 'ADMIN') {
    throw new AppError('Invalid role for TOTP setup token', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  const exp = nowSeconds() + env.totpSetupTokenTtlSeconds;
  const token = await new SignJWT({ role: user.role, typ: 'totp_setup' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(accessSecret);

  return { token, exp };
}

export async function signMfaChallengeToken(user: AuthenticatedUser): Promise<{ token: string; exp: number }> {
  if (user.role !== 'ADMIN') {
    throw new AppError('Invalid role for MFA challenge token', { statusCode: 500, code: 'AUTH_CONFIG_ERROR' });
  }

  const exp = nowSeconds() + env.mfaChallengeTokenTtlSeconds;
  const token = await new SignJWT({ role: user.role, typ: 'mfa_challenge' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(accessSecret);

  return { token, exp };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenClaims> {
  try {
    // Verifies signature + exp/nbf claims via jose.
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'access') {
      // Why: prevents token confusion (e.g., using refresh token as access token).
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
      // Why: never trust JWT claims blindly; validate types.
      throw new AppError('Invalid token payload', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (payload.role !== 'ADMIN' && payload.role !== 'DRIVER' && payload.role !== 'PASSENGER') {
      // Why: role is an enum in our system; reject unknown roles even if token verifies.
      throw new AppError('Invalid token role', { statusCode: 401, code: 'UNAUTHORIZED' });
    }

    return { sub: payload.sub, role: payload.role, typ: 'access' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof JoseErrors.JWTExpired) {
      // Used by clients to distinguish "expired" vs "invalid".
      throw new AppError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED', cause: err });
    }
    throw new AppError('Invalid token', { statusCode: 401, code: 'UNAUTHORIZED', cause: err });
  }
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenClaims> {
  try {
    // Refresh token uses a different secret than access token.
    const { payload } = await jwtVerify(token, refreshSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'refresh') {
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || typeof payload.role !== 'string' || typeof payload.jti !== 'string') {
      // Why: we require jti for rotation/revocation tracking.
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

export async function verifyTotpSetupToken(token: string): Promise<TotpSetupTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'totp_setup') {
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || payload.role !== 'ADMIN') {
      throw new AppError('Invalid token payload', { statusCode: 401, code: 'UNAUTHORIZED' });
    }

    return { sub: payload.sub, role: 'ADMIN', typ: 'totp_setup' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof JoseErrors.JWTExpired) {
      throw new AppError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED', cause: err });
    }
    throw new AppError('Invalid token', { statusCode: 401, code: 'UNAUTHORIZED', cause: err });
  }
}

export async function verifyMfaChallengeToken(token: string): Promise<MfaChallengeTokenClaims> {
  try {
    const { payload } = await jwtVerify(token, accessSecret, { algorithms: ['HS256'] });
    if (payload.typ !== 'mfa_challenge') {
      throw new AppError('Invalid token type', { statusCode: 401, code: 'UNAUTHORIZED' });
    }
    if (typeof payload.sub !== 'string' || payload.role !== 'ADMIN') {
      throw new AppError('Invalid token payload', { statusCode: 401, code: 'UNAUTHORIZED' });
    }

    return { sub: payload.sub, role: 'ADMIN', typ: 'mfa_challenge' };
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (err instanceof JoseErrors.JWTExpired) {
      throw new AppError('Token expired', { statusCode: 401, code: 'TOKEN_EXPIRED', cause: err });
    }
    throw new AppError('Invalid token', { statusCode: 401, code: 'UNAUTHORIZED', cause: err });
  }
}
