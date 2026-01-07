import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { verifyPassword } from '../password.js';
import { enforceAdminOrigin } from '../middleware.js';
import { getEffectiveAdminPermissions } from '../../rbac/permissions.js';
import { aes256gcmDecrypt, aes256gcmEncrypt } from '../../util/crypto.js';
import { buildOtpauthUri, generateTotpSecret, verifyTotp } from '../totp.js';
import { issueRefreshToken, revokeRefreshTokenByRaw, rotateRefreshToken } from '../refreshTokens.js';
import { httpError } from '../../util/httpErrors.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

const VerifyMfaSchema = z.object({
  mfaToken: z.string().min(1),
  code: z.string().min(4).max(10)
});

const EnrollSetupSchema = z.object({
  enrollToken: z.string().min(1)
});

const EnrollConfirmSchema = z.object({
  enrollToken: z.string().min(1),
  code: z.string().min(4).max(10)
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(10)
});

const LogoutSchema = z.object({
  refreshToken: z.string().min(10)
});

export async function registerAdminAuthRoutes(app: FastifyInstance) {
  const aud = app.config.jwt.aud.admin;
  const totpKey = Buffer.from(app.config.totpEncKeyBase64, 'base64');

  app.post(
    '/admin/auth/login',
    {
      schema: {
        tags: ['Admin Auth'],
        summary: 'Admin login (step 1: password)',
        description: 'Admin login is restricted to the Web Admin client (Origin allowlist + aud=admin-web). Returns mfaToken or enrollToken.',
        body: {
          type: 'object',
          required: ['email', 'password'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email', default: 'admin@example.com', example: 'admin@example.com' },
            password: { type: 'string', minLength: 8, default: 'ChangeMe123!', example: 'ChangeMe123!' }
          }
        },
        response: {
          200: {
            type: 'object',
            additionalProperties: false,
            required: ['mfaRequired', 'mfaToken'],
            properties: {
              mfaRequired: { type: 'boolean' },
              mfaToken: { type: 'string' }
            }
          },
          428: {
            type: 'object',
            additionalProperties: false,
            required: ['error', 'enrollToken'],
            properties: {
              error: { type: 'string' },
              enrollToken: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
    enforceAdminOrigin(app, req);

    const body = LoginSchema.parse(req.body);

    const userResult = await app.db.query<{
      id: string;
      user_type: 'ADMIN';
      password_hash: string;
      is_active: boolean;
      locked_until: Date | null;
      failed_login_count: number;
    }>(
      `select id, user_type, password_hash, is_active, locked_until, failed_login_count
       from users
       where user_type = 'ADMIN' and email = $1`,
      [body.email]
    );

    if (userResult.rowCount !== 1) {
      throw httpError(401, 'Invalid credentials');
    }

    const user = userResult.rows[0];
    if (!user.is_active) throw httpError(403, 'Account disabled');
    if (user.locked_until && user.locked_until.getTime() > Date.now()) {
      throw httpError(429, 'Account temporarily locked');
    }

    const ok = await verifyPassword(user.password_hash, body.password);
    if (!ok) {
      const nextFailed = user.failed_login_count + 1;
      const lockUntil = nextFailed >= 10 ? new Date(Date.now() + 15 * 60 * 1000) : null;
      await app.db.query(
        'update users set failed_login_count = $2, locked_until = $3 where id = $1',
        [user.id, nextFailed, lockUntil]
      );
      throw httpError(401, 'Invalid credentials');
    }

    // Reset counters
    await app.db.query('update users set failed_login_count = 0, locked_until = null where id = $1', [user.id]);

    const totpRow = await app.db.query<{ secret_enc: Buffer; enabled: boolean }>(
      'select secret_enc, enabled from admin_totp where user_id = $1',
      [user.id]
    );

    if (totpRow.rowCount !== 1 || !totpRow.rows[0].enabled) {
      // Require enrollment before issuing normal tokens.
      const enrollToken = await app.jwt.signEnrollToken({ userId: user.id, aud });
      return reply.status(428).send({
        error: 'TWO_FACTOR_ENROLLMENT_REQUIRED',
        enrollToken
      });
    }

    const mfaToken = await app.jwt.signMfaToken({ userId: user.id, aud });
    return reply.send({ mfaRequired: true, mfaToken });
    }
  );

  app.post(
    '/admin/auth/verify-2fa',
    {
      schema: {
        tags: ['Admin Auth'],
        summary: 'Admin login (step 2: verify TOTP)',
        body: {
          type: 'object',
          required: ['mfaToken', 'code'],
          additionalProperties: false,
          properties: {
            mfaToken: { type: 'string', example: 'paste_mfaToken_here' },
            code: { type: 'string', minLength: 4, maxLength: 10, default: '123456', example: '123456' }
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
    enforceAdminOrigin(app, req);
    const body = VerifyMfaSchema.parse(req.body);

    const payload = await app.jwt.verify(body.mfaToken, { aud, typ: 'mfa' });
    const userId = String(payload.sub);

    const totpRow = await app.db.query<{ secret_enc: Buffer; enabled: boolean }>(
      'select secret_enc, enabled from admin_totp where user_id = $1',
      [userId]
    );
    if (totpRow.rowCount !== 1 || !totpRow.rows[0].enabled) throw httpError(403, '2FA not enabled');

    const secret = aes256gcmDecrypt(totpRow.rows[0].secret_enc, totpKey).toString('utf8');
    if (!verifyTotp(body.code, secret)) throw httpError(401, 'Invalid 2FA code');

    const perms = await getEffectiveAdminPermissions(app.db, userId);
    const accessToken = await app.jwt.signAccessToken({ userId, userType: 'ADMIN', aud, permissions: perms });

    const refresh = await issueRefreshToken(app.db, {
      userId,
      ttlDays: app.config.jwt.refreshTtlDays,
      ip: req.ip,
      ua: req.headers['user-agent']
    });

    await app.db.query('update users set last_login_at = now() where id = $1', [userId]);

    return reply.send({
      accessToken,
      refreshToken: refresh.refreshToken,
      expiresAt: refresh.expiresAt.toISOString()
    });
    }
  );

  app.post(
    '/admin/auth/2fa/setup',
    {
      schema: {
        tags: ['Admin Auth'],
        summary: 'Admin TOTP enrollment setup',
        body: {
          type: 'object',
          required: ['enrollToken'],
          additionalProperties: false,
          properties: {
            enrollToken: { type: 'string', example: 'paste_enrollToken_here' }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['secret', 'otpauthUri'],
            additionalProperties: false,
            properties: {
              secret: { type: 'string' },
              otpauthUri: { type: 'string' }
            }
          }
        }
      }
    },
    async (req, reply) => {
    enforceAdminOrigin(app, req);
    const body = EnrollSetupSchema.parse(req.body);

    const payload = await app.jwt.verify(body.enrollToken, { aud, typ: 'enroll' });
    const userId = String(payload.sub);

    const secret = generateTotpSecret();
    const secretEnc = aes256gcmEncrypt(Buffer.from(secret, 'utf8'), totpKey);

    await app.db.query(
      `insert into admin_totp(user_id, secret_enc, enabled)
       values ($1, $2, false)
       on conflict (user_id) do update set secret_enc = excluded.secret_enc, enabled = false`,
      [userId, secretEnc]
    );

    const otpauthUri = buildOtpauthUri({ issuer: app.config.jwt.issuer, accountName: `admin:${userId}`, secret });

    return reply.send({ secret, otpauthUri });
    }
  );

  app.post(
    '/admin/auth/2fa/confirm',
    {
      schema: {
        tags: ['Admin Auth'],
        summary: 'Admin TOTP enrollment confirm',
        body: {
          type: 'object',
          required: ['enrollToken', 'code'],
          additionalProperties: false,
          properties: {
            enrollToken: { type: 'string', example: 'paste_enrollToken_here' },
            code: { type: 'string', minLength: 4, maxLength: 10, default: '123456', example: '123456' }
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
    enforceAdminOrigin(app, req);
    const body = EnrollConfirmSchema.parse(req.body);

    const payload = await app.jwt.verify(body.enrollToken, { aud, typ: 'enroll' });
    const userId = String(payload.sub);

    const totpRow = await app.db.query<{ secret_enc: Buffer }>('select secret_enc from admin_totp where user_id = $1', [userId]);
    if (totpRow.rowCount !== 1) throw httpError(400, '2FA not initialized');

    const secret = aes256gcmDecrypt(totpRow.rows[0].secret_enc, totpKey).toString('utf8');
    if (!verifyTotp(body.code, secret)) throw httpError(401, 'Invalid 2FA code');

    await app.db.query('update admin_totp set enabled = true, enrolled_at = now() where user_id = $1', [userId]);

    const perms = await getEffectiveAdminPermissions(app.db, userId);
    const accessToken = await app.jwt.signAccessToken({ userId, userType: 'ADMIN', aud, permissions: perms });

    const refresh = await issueRefreshToken(app.db, {
      userId,
      ttlDays: app.config.jwt.refreshTtlDays,
      ip: req.ip,
      ua: req.headers['user-agent']
    });

    await app.db.query('update users set last_login_at = now() where id = $1', [userId]);

    return reply.send({ accessToken, refreshToken: refresh.refreshToken, expiresAt: refresh.expiresAt.toISOString() });
    }
  );

  app.post(
    '/admin/auth/refresh',
    {
      schema: {
        tags: ['Admin Auth'],
        summary: 'Refresh Admin tokens (rotating refresh tokens)',
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
    enforceAdminOrigin(app, req);
    const body = RefreshSchema.parse(req.body);
    const rotated = await rotateRefreshToken(app.db, {
      rawToken: body.refreshToken,
      ttlDays: app.config.jwt.refreshTtlDays,
      ip: req.ip,
      ua: req.headers['user-agent']
    });

    const perms = await getEffectiveAdminPermissions(app.db, rotated.userId);
    const accessToken = await app.jwt.signAccessToken({ userId: rotated.userId, userType: 'ADMIN', aud, permissions: perms });

    return reply.send({ accessToken, refreshToken: rotated.refreshToken, expiresAt: rotated.expiresAt.toISOString() });
    }
  );

  app.post(
    '/admin/auth/logout',
    {
      schema: {
        tags: ['Admin Auth'],
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
    enforceAdminOrigin(app, req);
    const body = LogoutSchema.parse(req.body);
    await revokeRefreshTokenByRaw(app.db, body.refreshToken, 'logout');
    return reply.send({ ok: true });
    }
  );
}
