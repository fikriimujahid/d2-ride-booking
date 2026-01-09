import test from 'node:test';
import assert from 'node:assert/strict';

// Ensure required config exists for app boot.
// Use HS256 in tests to avoid PEM key requirements.
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env.LOG_LEVEL = process.env.LOG_LEVEL ?? 'silent';
process.env.PORT = process.env.PORT ?? '0';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://user:pass@127.0.0.1:5432/ridebooking';
process.env.JWT_ISSUER = process.env.JWT_ISSUER ?? 'test-issuer';
process.env.JWT_AUD_ADMIN = process.env.JWT_AUD_ADMIN ?? 'admin-web';
process.env.JWT_AUD_DRIVER = process.env.JWT_AUD_DRIVER ?? 'driver-app';
process.env.JWT_AUD_PASSENGER = process.env.JWT_AUD_PASSENGER ?? 'passenger-app';
process.env.JWT_ALG = process.env.JWT_ALG ?? 'HS256';
process.env.JWT_SECRET = process.env.JWT_SECRET ?? 'test-secret';
process.env.TOTP_ENC_KEY_BASE64 =
  process.env.TOTP_ENC_KEY_BASE64 ?? 'MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY='; // 32 bytes base64

const { buildApp } = await import('../dist/app.js');

test('health endpoint responds', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/health' });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.json(), { ok: true });
  await app.close();
});

test('openapi endpoint responds', async () => {
  const app = await buildApp();
  const res = await app.inject({ method: 'GET', url: '/openapi.json' });
  assert.equal(res.statusCode, 200);
  const json = res.json();
  assert.equal(json?.openapi, '3.0.3');
  await app.close();
});
