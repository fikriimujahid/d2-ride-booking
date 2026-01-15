import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';
import { hashPassword } from '../src/modules/auth/password.js';
import { generateSync } from 'otplib';
import { signAccessToken } from '../src/modules/auth/jwt.js';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type OkResponse = {
  ok: true;
};

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
};

const loginPaths = ['/api/v1/admin/auth/login', '/api/v1/driver/auth/login', '/api/v1/passenger/auth/login'] as const;
const refreshPaths = ['/api/v1/admin/auth/refresh', '/api/v1/driver/auth/refresh', '/api/v1/passenger/auth/refresh'] as const;
const logoutPaths = ['/api/v1/admin/auth/logout', '/api/v1/driver/auth/logout', '/api/v1/passenger/auth/logout'] as const;

describe('auth (role-specific endpoints)', () => {
  it.each(loginPaths)('POST %s validates request body', async (url) => {
    const app = buildApp({ logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url,
      payload: { password: 'ChangeMe123!' }
    });

    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it.each(loginPaths)('POST %s returns 401 for invalid credentials', async (url) => {
    const app = buildApp({ logger: false });
    await app.ready();

    const queryMock = vi.fn(async () => ({ rows: [] as unknown[] }));
    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const res = await app.inject({
      method: 'POST',
      url,
      payload: { email: 'someone@example.com', password: 'WrongPassword123!' }
    });

    expect(res.statusCode).toBe(401);
    const body = res.json() as ErrorResponse;
    expect(body.error.code).toBe('INVALID_CREDENTIALS');

    await app.close();
  });

  it.each(refreshPaths)('POST %s returns 401 for invalid refresh token', async (url) => {
    const app = buildApp({ logger: false });
    await app.ready();

    const queryMock = vi.fn(async () => ({ rows: [] as unknown[] }));
    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const res = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: 'not-a-jwt-not-a-jwt-not-a-jwt' }
    });

    expect(res.statusCode).toBe(401);
    // JWT verification fails before DB lookup
    expect(queryMock).not.toHaveBeenCalled();

    await app.close();
  });

  it.each(logoutPaths)('POST %s returns ok (best-effort revoke)', async (url) => {
    const app = buildApp({ logger: false });
    await app.ready();

    const queryMock = vi.fn(async () => ({ rows: [] as unknown[] }));
    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const res = await app.inject({
      method: 'POST',
      url,
      payload: { refreshToken: 'dummy-refresh-token-for-test' }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as OkResponse;
    expect(body.ok).toBe(true);
    // Best-effort: lookup token then revoke.
    expect(queryMock).toHaveBeenCalledTimes(2);

    await app.close();
  });
});

describe('auth (admin TOTP 2FA)', () => {
  it('POST /api/v1/admin/auth/login returns a 2FA setup token when 2FA is not enabled', async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const password = 'ChangeMe123!';
    const password_hash = await hashPassword(password);

    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('FROM users WHERE role = $1')) {
        return {
          rows: [
            {
              id: '00000000-0000-0000-0000-000000000001',
              role: 'ADMIN',
              email: 'admin@example.com',
              phone: null,
              password_hash,
              is_active: true
            }
          ]
        };
      }
      if (sql.includes('FROM user_totp')) {
        return { rows: [] };
      }
      return { rows: [] };
    });
    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'admin@example.com', password }
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { twoFactorRequired: true; setupToken: string; expiresAt: string };
    expect(body.twoFactorRequired).toBe(true);
    expect(typeof body.setupToken).toBe('string');
    expect(typeof body.expiresAt).toBe('string');

    await app.close();
  });

  it('Admin can setup + verify TOTP via setup token, then login uses SOFTWARE_TOKEN_MFA challenge', async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const password = 'ChangeMe123!';
    const password_hash = await hashPassword(password);
    const userId = '00000000-0000-0000-0000-000000000001';

    let storedSecretEnc: Buffer | null = null;
    let totpEnabled = false;

    const queryMock = vi.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM users WHERE role = $1')) {
        return {
          rows: [
            {
              id: userId,
              role: 'ADMIN',
              email: 'admin@example.com',
              phone: null,
              password_hash,
              is_active: true
            }
          ]
        };
      }

      if (sql.includes('SELECT email FROM users WHERE id = $1')) {
        return { rows: [{ email: 'admin@example.com' }] };
      }

      if (sql.includes('SELECT id, is_active FROM users WHERE id = $1')) {
        const id = params?.[0];
        return { rows: typeof id === 'string' ? [{ id, is_active: true }] : [] };
      }

      if (sql.includes('INSERT INTO user_totp')) {
        storedSecretEnc = params?.[1] as Buffer;
        totpEnabled = false;
        return { rows: [] };
      }

      if (sql.includes('SELECT user_id, secret_enc, enabled FROM user_totp')) {
        if (!storedSecretEnc) return { rows: [] };
        return {
          rows: [
            {
              user_id: userId,
              secret_enc: storedSecretEnc,
              enabled: totpEnabled
            }
          ]
        };
      }

      if (sql.startsWith('UPDATE user_totp SET enabled = true')) {
        totpEnabled = true;
        return { rows: [] };
      }

      if (sql.includes('INSERT INTO refresh_tokens')) {
        return { rows: [] };
      }

      return { rows: [] };
    });

    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'admin@example.com', password }
    });
    expect(loginRes.statusCode).toBe(200);
    const loginBody = loginRes.json() as { twoFactorRequired: true; setupToken: string; expiresAt: string };
    expect(loginBody.twoFactorRequired).toBe(true);
    const setupToken = loginBody.setupToken;

    const setupRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/2fa/setup',
      headers: { authorization: `Bearer ${setupToken}` },
      payload: {}
    });
    expect(setupRes.statusCode).toBe(200);
    const setupBody = setupRes.json() as { secretBase32: string; otpauthUrl: string; qrCodeDataUrl: string };
    expect(typeof setupBody.secretBase32).toBe('string');
    expect(setupBody.otpauthUrl.startsWith('otpauth://')).toBe(true);
    expect(setupBody.qrCodeDataUrl.startsWith('data:image/png;base64,')).toBe(true);

    const otp = generateSync({ secret: setupBody.secretBase32 });

    const verifyRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/2fa/verify',
      headers: { authorization: `Bearer ${setupToken}` },
      payload: { otp }
    });
    expect(verifyRes.statusCode).toBe(200);
    const verifiedTokens = verifyRes.json() as TokenResponse;
    expect(typeof verifiedTokens.accessToken).toBe('string');
    expect(typeof verifiedTokens.refreshToken).toBe('string');
    expect(typeof verifiedTokens.expiresAt).toBe('string');

    const loginResAfter2fa = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'admin@example.com', password }
    });

    expect(loginResAfter2fa.statusCode).toBe(200);
    const challenge = loginResAfter2fa.json() as { challengeName: string; session: string; expiresAt: string };
    expect(challenge.challengeName).toBe('SOFTWARE_TOKEN_MFA');
    expect(typeof challenge.session).toBe('string');
    expect(typeof challenge.expiresAt).toBe('string');

    const mfaRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login/mfa',
      payload: { session: challenge.session, otp: generateSync({ secret: setupBody.secretBase32 }) }
    });
    expect(mfaRes.statusCode).toBe(200);
    const okBody = mfaRes.json() as TokenResponse;
    expect(typeof okBody.accessToken).toBe('string');
    expect(typeof okBody.refreshToken).toBe('string');
    expect(typeof okBody.expiresAt).toBe('string');

    await app.close();
  });
});

describe('auth (permission middleware)', () => {
  it('GET /api/v1/admin/auth/permissions requires ADMIN role (not a specific permission)', async () => {
    const app = buildApp({ logger: false });
    await app.ready();

    const userId = '00000000-0000-0000-0000-000000000001';
    const { token: driverToken } = await signAccessToken({ userId, role: 'DRIVER' });
    const { token: adminToken } = await signAccessToken({ userId, role: 'ADMIN' });

    const queryMock = vi.fn(async (sql: string) => {
      if (sql.includes('SELECT DISTINCT p.code')) {
        return { rows: [{ code: 'admin:rbac:read' }] };
      }
      return { rows: [] };
    });
    (app.db as unknown as { query: typeof queryMock }).query = queryMock;

    const roleForbiddenRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/auth/permissions',
      headers: { authorization: `Bearer ${driverToken}` }
    });
    expect(roleForbiddenRes.statusCode).toBe(403);
    const okRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/auth/permissions',
      headers: { authorization: `Bearer ${adminToken}` }
    });
    expect(okRes.statusCode).toBe(200);
    const okBody = okRes.json() as { permissions: string[] };
    expect(okBody.permissions).toContain('admin:rbac:read');

    await app.close();
  });
});
