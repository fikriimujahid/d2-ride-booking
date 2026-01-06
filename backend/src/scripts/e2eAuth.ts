import http from 'node:http';

import { SignJWT } from 'jose';
import { z } from 'zod';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function startServer() {
  // Ensure auth middleware can verify tokens.
  process.env.NODE_ENV ??= 'test';
  process.env.JWT_SECRET ??= 'dev-only-e2e-secret-change-me';

  const { createApp } = await import('../app');
  const app = createApp();

  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  assert(address && typeof address === 'object', 'Expected server to be listening');

  const baseUrl = `http://127.0.0.1:${address.port}`;

  return { server, baseUrl };
}

async function signTestToken(payload: { role: 'admin' | 'driver' | 'passenger' }, subject: string) {
  const secret = new TextEncoder().encode(process.env.JWT_SECRET);

  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(subject)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  let json: unknown = undefined;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  return { res, json };
}

async function main() {
  const { server, baseUrl } = await startServer();

  try {
    const health = await getJson(`${baseUrl}/health`);
    assert(health.res.status === 200, `Expected /health 200, got ${health.res.status}`);

    const whoamiNoToken = await getJson(`${baseUrl}/auth/whoami`);
    assert(whoamiNoToken.res.status === 401, `Expected /auth/whoami 401, got ${whoamiNoToken.res.status}`);

    const token = await signTestToken({ role: 'passenger' }, 'user-123');

    const whoamiWithToken = await getJson(`${baseUrl}/auth/whoami`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    assert(
      whoamiWithToken.res.status === 200,
      `Expected /auth/whoami 200, got ${whoamiWithToken.res.status}`,
    );

    const whoamiSchema = z.object({
      user: z.object({
        userId: z.string(),
        role: z.enum(['admin', 'driver', 'passenger']),
      }),
    });

    const body = whoamiSchema.parse(whoamiWithToken.json);
    assert(body.user.userId === 'user-123', 'Expected userId to match token subject');
    assert(body.user.role === 'passenger', 'Expected role to match token payload');

    console.log('E2E auth test: PASS');
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  }
}

main().catch((err) => {
  console.error('E2E auth test: FAIL');
  console.error(err);
  process.exitCode = 1;
});
