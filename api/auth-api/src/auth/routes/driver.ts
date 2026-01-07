import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyPassword } from '../password.js';
import { issueRefreshToken, revokeRefreshTokenByRaw, rotateRefreshToken } from '../refreshTokens.js';
import { httpError } from '../../util/httpErrors.js';

const LoginSchema = z.object({
  identifier: z.string().min(3),
  password: z.string().min(8)
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10)
});

const LogoutSchema = z.object({
  refreshToken: z.string().min(10)
});

export async function registerDriverAuthRoutes(app: FastifyInstance) {
  const aud = app.config.jwt.aud.driver;

  app.post(
    '/driver/auth/login',
    {
      schema: {
        tags: ['Driver Auth'],
        summary: 'Driver login',
        body: {
          type: 'object',
          required: ['identifier', 'password'],
          additionalProperties: false,
          properties: {
            identifier: {
              type: 'string',
              minLength: 3,
              description: 'Email or phone',
              default: 'driver@example.com',
              example: 'driver@example.com'
            },
            password: { type: 'string', minLength: 8, default: 'ChangeMe123!', example: 'ChangeMe123!' }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['accessToken', 'refreshToken', 'expiresAt'],
            additionalProperties: false,
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresAt: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
    const body = LoginSchema.parse(req.body);

    const userResult = await app.db.query<{
      id: string;
      user_type: 'DRIVER';
      password_hash: string;
      is_active: boolean;
      locked_until: Date | null;
      failed_login_count: number;
    }>(
      `select id, user_type, password_hash, is_active, locked_until, failed_login_count
       from users
       where user_type = 'DRIVER' and (email = $1 or phone = $1)`,
      [body.identifier]
    );

    if (userResult.rowCount !== 1) throw httpError(401, 'Invalid credentials');

    const user = userResult.rows[0];
    if (!user.is_active) throw httpError(403, 'Account disabled');
    if (user.locked_until && user.locked_until.getTime() > Date.now()) throw httpError(429, 'Account temporarily locked');

    const ok = await verifyPassword(user.password_hash, body.password);
    if (!ok) {
      const nextFailed = user.failed_login_count + 1;
      const lockUntil = nextFailed >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await app.db.query('update users set failed_login_count = $2, locked_until = $3 where id = $1', [user.id, nextFailed, lockUntil]);
      throw httpError(401, 'Invalid credentials');
    }

    await app.db.query('update users set failed_login_count = 0, locked_until = null, last_login_at = now() where id = $1', [user.id]);

    const accessToken = await app.jwt.signAccessToken({ userId: user.id, userType: 'DRIVER', aud });
    const refresh = await issueRefreshToken(app.db, {
      userId: user.id,
      ttlDays: app.config.jwt.refreshTtlDays,
      ip: req.ip,
      ua: req.headers['user-agent']
    });

    return reply.send({ accessToken, refreshToken: refresh.refreshToken, expiresAt: refresh.expiresAt.toISOString() });
    }
  );

  app.post(
    '/driver/auth/refresh',
    {
      schema: {
        tags: ['Driver Auth'],
        summary: 'Refresh Driver tokens',
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: {
            refreshToken: { type: 'string', minLength: 10, example: 'paste_refreshToken_here' }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['accessToken', 'refreshToken', 'expiresAt'],
            additionalProperties: false,
            properties: {
              accessToken: { type: 'string' },
              refreshToken: { type: 'string' },
              expiresAt: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
    const body = RefreshSchema.parse(req.body);
    const rotated = await rotateRefreshToken(app.db, {
      rawToken: body.refreshToken,
      ttlDays: app.config.jwt.refreshTtlDays,
      ip: req.ip,
      ua: req.headers['user-agent']
    });

    const accessToken = await app.jwt.signAccessToken({ userId: rotated.userId, userType: 'DRIVER', aud });
    return reply.send({ accessToken, refreshToken: rotated.refreshToken, expiresAt: rotated.expiresAt.toISOString() });
    }
  );

  app.post(
    '/driver/auth/logout',
    {
      schema: {
        tags: ['Driver Auth'],
        summary: 'Logout (revoke refresh token)',
        body: {
          type: 'object',
          required: ['refreshToken'],
          additionalProperties: false,
          properties: {
            refreshToken: { type: 'string', minLength: 10, example: 'paste_refreshToken_here' }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['ok'],
            additionalProperties: false,
            properties: {
              ok: { type: 'boolean' }
            }
          }
        }
      }
    },
    async (req, reply) => {
    const body = LogoutSchema.parse(req.body);
    await revokeRefreshTokenByRaw(app.db, body.refreshToken, 'logout');
    return reply.send({ ok: true });
    }
  );
}
