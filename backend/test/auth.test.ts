import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../src/app.js';

type ErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

type OkResponse = {
  ok: true;
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
    expect(queryMock).toHaveBeenCalledTimes(1);

    await app.close();
  });
});
