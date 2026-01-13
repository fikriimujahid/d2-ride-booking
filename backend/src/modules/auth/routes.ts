import type { FastifyPluginAsync } from 'fastify';
import { roleLoginBodySchema, refreshBodySchema, logoutBodySchema, tokenResponseSchema } from './schemas.js';
import type { RoleLoginBody, RefreshBody, LogoutBody, TokenResponse } from './schemas.js';
import { loginWithRole, refreshWithRole, logout } from './service.js';
import type { UserRole } from './types.js';
import { env } from '../../config/env.js';

function rolePrefix(role: UserRole): string {
  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'DRIVER':
      return '/driver';
    case 'PASSENGER':
      return '/passenger';
  }
}

export const authRoutes: FastifyPluginAsync = async (app) => {
  const roles: readonly UserRole[] = ['ADMIN', 'DRIVER', 'PASSENGER'];

  for (const role of roles) {
    const prefix = rolePrefix(role);
    const exampleEmail =
      role === 'ADMIN'
        ? env.seedAdminEmail
        : role === 'DRIVER'
          ? env.seedDriverEmail
          : env.seedPassengerEmail;
    const examplePassword =
      role === 'ADMIN'
        ? env.seedAdminPassword
        : role === 'DRIVER'
          ? env.seedDriverPassword
          : env.seedPassengerPassword;

    const roleLoginBodySchemaWithExample = {
      ...roleLoginBodySchema,
      example: {
        email: exampleEmail,
        password: examplePassword
      }
    };

    app.post<{ Body: RoleLoginBody; Reply: TokenResponse }>(
      `${prefix}/auth/login`,
      {
        schema: {
          tags: ['auth'],
          summary: `${role} login and receive access + refresh tokens`,
          body: roleLoginBodySchemaWithExample,
          response: {
            200: tokenResponseSchema
          }
        }
      },
      async (request) => {
        const ip = request.ip;
        const userAgent = request.headers['user-agent'];
        return await loginWithRole(app.db, role, request.body, {
          ip,
          userAgent: typeof userAgent === 'string' ? userAgent : undefined
        });
      }
    );

    app.post<{ Body: RefreshBody; Reply: TokenResponse }>(
      `${prefix}/auth/refresh`,
      {
        schema: {
          tags: ['auth'],
          summary: `${role} refresh session`,
          body: refreshBodySchema,
          response: {
            200: tokenResponseSchema
          }
        }
      },
      async (request) => {
        const ip = request.ip;
        const userAgent = request.headers['user-agent'];
        return await refreshWithRole(app.db, role, request.body, {
          ip,
          userAgent: typeof userAgent === 'string' ? userAgent : undefined
        });
      }
    );

    app.post<{ Body: LogoutBody; Reply: { ok: boolean } }>(
      `${prefix}/auth/logout`,
      {
        schema: {
          tags: ['auth'],
          summary: `${role} logout (revoke refresh token best-effort)`,
          body: logoutBodySchema,
          response: {
            200: {
              type: 'object',
              properties: { ok: { type: 'boolean' } },
              required: ['ok']
            }
          }
        }
      },
      async (request) => {
        await logout(app.db, request.body);
        return { ok: true };
      }
    );
  }
};
