import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

describe('health', () => {
  it('GET /api/v1/health returns ok', async () => {
    const app = buildApp({ logger: false });

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/health'
    });

    expect(res.statusCode).toBe(200);
    const body = res.json() as { status: string; uptimeSeconds: number };
    expect(body.status).toBe('ok');
    expect(typeof body.uptimeSeconds).toBe('number');

    await app.close();
  });
});
