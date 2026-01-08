import { importPKCS8, importSPKI, jwtVerify, SignJWT, type JWTPayload } from 'jose';
import crypto from 'node:crypto';
import type { UserType } from './types.js';

type JwtConfig = {
  issuer: string;
  aud: { admin: string; driver: string; passenger: string };
  alg: 'EdDSA' | 'RS256' | 'HS256';
  kid: string;
  privateKeyPem?: string;
  publicKeyPem?: string;
  secret?: string;
  accessTtlSeconds: number;
  mfaTtlSeconds: number;
  enrollTtlSeconds: number;
};

type AccessClaims = {
  typ: 'access';
  ut: UserType;
};

type MfaClaims = {
  typ: 'mfa';
  ut: 'ADMIN';
};

type EnrollClaims = {
  typ: 'enroll';
  ut: 'ADMIN';
};

export function createJwtService(config: JwtConfig) {
  let signingKeyPromise: Promise<unknown> | undefined;
  let verifyKeyPromise: Promise<unknown> | undefined;

  async function getSigningKey() {
    if (!signingKeyPromise) {
      signingKeyPromise = (async () => {
        if (config.alg === 'HS256') {
          if (!config.secret) throw new Error('JWT_SECRET required for HS256');
          return crypto.createSecretKey(Buffer.from(config.secret, 'utf8')) as unknown;
        }
        if (!config.privateKeyPem) throw new Error('JWT_PRIVATE_KEY_PEM required');
        return importPKCS8(config.privateKeyPem, config.alg);
      })();
    }
    return signingKeyPromise;
  }

  async function getVerifyKey() {
    if (!verifyKeyPromise) {
      verifyKeyPromise = (async () => {
        if (config.alg === 'HS256') {
          if (!config.secret) throw new Error('JWT_SECRET required for HS256');
          return crypto.createSecretKey(Buffer.from(config.secret, 'utf8')) as unknown;
        }
        if (!config.publicKeyPem) throw new Error('JWT_PUBLIC_KEY_PEM required');
        return importSPKI(config.publicKeyPem, config.alg);
      })();
    }
    return verifyKeyPromise;
  }

  async function signBase(payload: JWTPayload & { typ: string; ut: UserType }, opts: { aud: string; ttlSeconds: number }) {
    const now = Math.floor(Date.now() / 1000);
    const jti = crypto.randomUUID();
    return new SignJWT(payload)
      .setProtectedHeader({ alg: config.alg, kid: config.kid, typ: 'JWT' })
      .setIssuedAt(now)
      .setIssuer(config.issuer)
      .setAudience(opts.aud)
      .setSubject(String(payload.sub))
      .setJti(jti)
      .setExpirationTime(now + opts.ttlSeconds)
        .sign((await getSigningKey()) as any);
  }

  return {
    signAccessToken: async (opts: { userId: string; userType: UserType; aud: string }) => {
      const payload: JWTPayload & AccessClaims = {
        sub: opts.userId,
        typ: 'access',
        ut: opts.userType
      };
      return signBase(payload, { aud: opts.aud, ttlSeconds: config.accessTtlSeconds });
    },

    signMfaToken: async (opts: { userId: string; aud: string }) => {
      const payload: JWTPayload & MfaClaims = { sub: opts.userId, typ: 'mfa', ut: 'ADMIN' };
      return signBase(payload, { aud: opts.aud, ttlSeconds: config.mfaTtlSeconds });
    },

    signEnrollToken: async (opts: { userId: string; aud: string }) => {
      const payload: JWTPayload & EnrollClaims = { sub: opts.userId, typ: 'enroll', ut: 'ADMIN' };
      return signBase(payload, { aud: opts.aud, ttlSeconds: config.enrollTtlSeconds });
    },

    verify: async (token: string, expected: { aud: string; typ: 'access' | 'mfa' | 'enroll' }) => {
      const { payload } = await jwtVerify(token, (await getVerifyKey()) as any, {
        issuer: config.issuer,
        audience: expected.aud
      });
      if (payload.typ !== expected.typ) {
        throw Object.assign(new Error('Invalid token type'), { statusCode: 401 });
      }
      return payload as JWTPayload & (AccessClaims | MfaClaims | EnrollClaims);
    },

    aud: config.aud
  };
}
