import type { FastifyPluginAsync } from 'fastify';
import {
  admin2faSetupResponseSchema,
  admin2faVerifyBodySchema,
  adminLoginResponseSchema,
  adminMfaRespondBodySchema,
  roleLoginBodySchema,
  refreshBodySchema,
  logoutBodySchema,
  tokenResponseSchema
} from './schemas.js';
import type {
  Admin2faSetupResponse,
  Admin2faVerifyBody,
  AdminLoginResponse,
  AdminMfaRespondBody,
  RoleLoginBody,
  RefreshBody,
  LogoutBody,
  TokenResponse
} from './schemas.js';
import {
  handleAdmin2faSetup,
  handleAdmin2faVerify,
  handleAdminLogin,
  handleAdminMfaResponse,
  handleListPermissions,
  handleLogout,
  handleRefreshSession,
  handleRoleLogin
} from './auth.controller.js';
import type { UserRole } from './types.js';
import { env } from '../../config/env.js';
import { requireAuth, requireRole, requireTotpSetupAuth } from './middleware.js';

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

    if (role === 'ADMIN') {
      app.post<{ Body: RoleLoginBody; Reply: AdminLoginResponse }>(
        `${prefix}/auth/login`,
        {
          schema: {
            tags: ['auth '+role],
            summary:
              'ADMIN login: returns a 2FA setup token (if not enrolled) or an MFA challenge session (if enrolled)',
            body: roleLoginBodySchemaWithExample,
            response: {
              200: adminLoginResponseSchema
            }
          }
        },
        async (request) => {
          return await handleAdminLogin(app.db, request);
        }
      );

      app.post<{ Body: AdminMfaRespondBody; Reply: TokenResponse }>(
        `${prefix}/auth/login/mfa`,
        {
          schema: {
            tags: ['auth '+role],
            summary: 'ADMIN respond to SOFTWARE_TOKEN_MFA challenge and receive access + refresh tokens',
            body: adminMfaRespondBodySchema,
            response: {
              200: tokenResponseSchema
            }
          }
        },
        async (request) => {
          return await handleAdminMfaResponse(app.db, request);
        }
      );
    } else {
      app.post<{ Body: RoleLoginBody; Reply: TokenResponse }>(
        `${prefix}/auth/login`,
        {
          schema: {
            tags: ['auth '+role],
            summary: `${role} login and receive access + refresh tokens`,
            body: roleLoginBodySchemaWithExample,
            response: {
              200: tokenResponseSchema
            }
          }
        },
        async (request) => {
          return await handleRoleLogin(app.db, role, request);
        }
      );
    }

    if (role === 'ADMIN') {
      app.post<{ Reply: Admin2faSetupResponse }>(
        `${prefix}/auth/2fa/setup`,
        {
          preHandler: [requireTotpSetupAuth()],
          schema: {
            tags: ['auth '+role],
            summary: 'Admin 2FA (TOTP) setup: returns secret + provisioning QR',
            response: {
              200: admin2faSetupResponseSchema
            }
          }
        },
        async (request) => {
          return await handleAdmin2faSetup(app.db, request);
        }
      );

      app.post<{ Body: Admin2faVerifyBody; Reply: TokenResponse }>(
        `${prefix}/auth/2fa/verify`,
        {
          preHandler: [requireTotpSetupAuth()],
          schema: {
            tags: ['auth '+role],
            summary: 'Admin 2FA (TOTP) verify: enables 2FA and returns access + refresh tokens',
            body: admin2faVerifyBodySchema,
            response: {
              200: tokenResponseSchema
            }
          }
        },
        async (request) => {
          return await handleAdmin2faVerify(app.db, request);
        }
      );

      app.get<{ Reply: { permissions: string[] } }>(
        `${prefix}/auth/permissions`,
        {
          preHandler: [requireAuth(), requireRole(['ADMIN'])],
          schema: {
            tags: ['auth '+role],
            summary: 'List current admin permissions (RBAC)',
            response: {
              200: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  permissions: {
                    type: 'array',
                    items: { type: 'string' }
                  }
                },
                required: ['permissions']
              }
            }
          }
        },
        async (request) => {
          return await handleListPermissions(app.db, request);
        }
      );
    }

    app.post<{ Body: RefreshBody; Reply: TokenResponse }>(
      `${prefix}/auth/refresh`,
      {
        schema: {
          tags: ['auth '+role],
          summary: `${role} refresh session`,
          body: refreshBodySchema,
          response: {
            200: tokenResponseSchema
          }
        }
      },
      async (request) => {
        return await handleRefreshSession(app.db, role, request);
      }
    );

    app.post<{ Body: LogoutBody; Reply: { ok: boolean } }>(
      `${prefix}/auth/logout`,
      {
        schema: {
          tags: ['auth '+role],
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
        return await handleLogout(app.db, request);
      }
    );
  }
};
