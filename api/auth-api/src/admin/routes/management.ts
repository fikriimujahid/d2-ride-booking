import type { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { enforceAdminOrigin, authenticateAccessToken, requireUserType, requirePermission } from '../../auth/middleware.js';
import { getEffectiveAdminPermissions } from '../../rbac/permissions.js';
import { httpError } from '../../util/httpErrors.js';
import { hashPassword } from '../../auth/password.js';

function adminAuthz(app: FastifyInstance, opts: { requiredPermission: string }) {
  const aud = app.config.jwt.aud.admin;
  return async (req: FastifyRequest) => {
    enforceAdminOrigin(app, req);
    const ctx = await authenticateAccessToken(app, req, { aud });
    requireUserType(req, 'ADMIN');

    // Load effective permissions from DB (NOT from JWT)
    ctx.permissions = await getEffectiveAdminPermissions(app.db, ctx.userId);

    requirePermission(req, opts.requiredPermission);
  };
}

const CreateAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(z.string().min(1)).min(1)
});

const UpdateAdminSchema = z.object({
  isActive: z.boolean().optional(),
  roles: z.array(z.string().min(1)).min(1).optional()
});

export async function registerAdminManagementRoutes(app: FastifyInstance) {
  const aud = app.config.jwt.aud.admin;

  // Catalog endpoints for UI
  app.get(
    '/admin/rbac/permissions',
    {
      schema: {
        tags: ['Admin RBAC'],
        summary: 'List all admin permissions',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            required: ['permissions'],
            additionalProperties: false,
            properties: {
              permissions: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['key'],
                  additionalProperties: false,
                  properties: {
                    key: { type: 'string' },
                    description: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.roles.view' })
    },
    async (_req, reply) => {
      const result = await app.db.query<{ key: string; description: string | null }>(
        'select key, description from admin_permissions order by key'
      );

      return reply.send({
        permissions: result.rows.map((r) => ({ key: r.key, ...(r.description ? { description: r.description } : {}) }))
      });
    }
  );

  app.get(
    '/admin/rbac/roles',
    {
      schema: {
        tags: ['Admin RBAC'],
        summary: 'List admin roles (with permissions)',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            required: ['roles'],
            additionalProperties: false,
            properties: {
              roles: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['name', 'permissions'],
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    description: { type: 'string' },
                    permissions: { type: 'array', items: { type: 'string' } }
                  }
                }
              }
            }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.roles.view' })
    },
    async (_req, reply) => {
      const result = await app.db.query<{
        name: string;
        description: string | null;
        permissions: string[] | null;
      }>(
        `select
           r.name,
           r.description,
           coalesce(array_agg(distinct p.key order by p.key) filter (where p.key is not null), '{}') as permissions
         from admin_roles r
         left join admin_role_permissions rp on rp.role_id = r.id
         left join admin_permissions p on p.id = rp.permission_id
         group by r.id
         order by r.name`
      );

      return reply.send({
        roles: result.rows.map((r) => ({
          name: r.name,
          ...(r.description ? { description: r.description } : {}),
          permissions: r.permissions ?? []
        }))
      });
    }
  );

  // Admin management endpoints
  app.get(
    '/admin/admins',
    {
      schema: {
        tags: ['Admin Management'],
        summary: 'List admin users',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            required: ['admins'],
            additionalProperties: false,
            properties: {
              admins: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['id', 'email', 'system_role', 'roles', 'permissions', 'is_active', 'two_factor_enabled', 'created_at'],
                  additionalProperties: false,
                  properties: {
                    id: { type: 'string' },
                    email: { type: 'string' },
                    full_name: { type: 'string' },
                    system_role: { type: 'string', enum: ['ADMIN'] },
                    roles: { type: 'array', items: { type: 'string' } },
                    permissions: { type: 'array', items: { type: 'string' } },
                    is_active: { type: 'boolean' },
                    two_factor_enabled: { type: 'boolean' },
                    last_login_at: { type: 'string' },
                    created_at: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.admins.view' })
    },
    async (_req, reply) => {
      const result = await app.db.query<{
        id: string;
        email: string;
        is_active: boolean;
        last_login_at: Date | null;
        created_at: Date;
        two_factor_enabled: boolean;
        roles: string[] | null;
        permissions: string[] | null;
      }>(
        `with recursive role_tree as (
           select ur.user_id, ur.role_id
           from admin_user_roles ur

           union

           select rt.user_id, inh.child_role_id
           from admin_role_inheritance inh
           join role_tree rt on rt.role_id = inh.parent_role_id
         ),
         perms as (
           select rt.user_id, p.key
           from role_tree rt
           join admin_role_permissions rp on rp.role_id = rt.role_id
           join admin_permissions p on p.id = rp.permission_id
         )
         select
           u.id,
           u.email,
           u.is_active,
           u.last_login_at,
           u.created_at,
           exists(select 1 from admin_totp t where t.user_id = u.id and t.enabled = true) as two_factor_enabled,
           coalesce(array_agg(distinct r.name) filter (where r.name is not null), '{}') as roles,
           coalesce(array_agg(distinct perms.key order by perms.key) filter (where perms.key is not null), '{}') as permissions
         from users u
         left join admin_user_roles ur on ur.user_id = u.id
         left join admin_roles r on r.id = ur.role_id
         left join perms on perms.user_id = u.id
         where u.user_type = 'ADMIN'
         group by u.id
         order by u.created_at desc`
      );

      return reply.send({
        admins: result.rows.map((r) => ({
          id: r.id,
          email: r.email,
          system_role: 'ADMIN' as const,
          roles: r.roles ?? [],
          permissions: r.permissions ?? [],
          is_active: r.is_active,
          two_factor_enabled: !!r.two_factor_enabled,
          ...(r.last_login_at ? { last_login_at: r.last_login_at.toISOString() } : {}),
          created_at: r.created_at.toISOString()
        }))
      });
    }
  );

  app.post(
    '/admin/admins',
    {
      schema: {
        tags: ['Admin Management'],
        summary: 'Create admin user',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['email', 'password', 'roles'],
          additionalProperties: false,
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            roles: { type: 'array', items: { type: 'string' }, minItems: 1 }
          }
        },
        response: {
          201: {
            type: 'object',
            required: ['id'],
            additionalProperties: false,
            properties: { id: { type: 'string' } }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.admins.manage' })
    },
    async (req, reply) => {
      // Explicit verify again for clarity in this handler
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) throw httpError(401, 'Missing bearer token');
      const payload = await app.jwt.verify(authHeader.substring(7), { aud, typ: 'access' });
      const actorId = String(payload.sub);

      const body = CreateAdminSchema.parse(req.body);

      const existing = await app.db.query('select 1 from users where email = $1', [body.email]);
      if (existing.rowCount) throw httpError(409, 'Email already exists');

      const roleRows = await app.db.query<{ id: string; name: string }>(
        'select id, name from admin_roles where name = any($1::text[])',
        [body.roles]
      );
      if (roleRows.rowCount !== body.roles.length) {
        throw httpError(400, 'One or more roles are invalid');
      }

      const passwordHash = await hashPassword(body.password);

      const client = await app.db.connect();
      try {
        await client.query('begin');

        const created = await client.query<{ id: string }>(
          `insert into users(user_type, email, password_hash, is_active)
           values ('ADMIN', $1, $2, true)
           returning id`,
          [body.email, passwordHash]
        );

        const userId = created.rows[0].id;

        for (const role of roleRows.rows) {
          await client.query(
            `insert into admin_user_roles(user_id, role_id)
             values ($1, $2)
             on conflict do nothing`,
            [userId, role.id]
          );
        }

        await client.query('commit');

        // Prevent accidental self-targeting bugs in UI flows
        if (userId === actorId) {
          req.log.warn('created admin equals actor id (unexpected)');
        }

        return reply.status(201).send({ id: userId });
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    }
  );

  app.patch(
    '/admin/admins/:id',
    {
      schema: {
        tags: ['Admin Management'],
        summary: 'Update admin roles / active status',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' }
          }
        },
        body: {
          type: 'object',
          additionalProperties: false,
          properties: {
            isActive: { type: 'boolean' },
            roles: { type: 'array', items: { type: 'string' }, minItems: 1 }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['ok'],
            additionalProperties: false,
            properties: { ok: { type: 'boolean' } }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.admins.manage' })
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) throw httpError(401, 'Missing bearer token');
      const payload = await app.jwt.verify(authHeader.substring(7), { aud, typ: 'access' });
      const actorId = String(payload.sub);

      const targetId = String((req.params as any).id);
      if (!targetId) throw httpError(400, 'Missing id');
      if (targetId === actorId) throw httpError(400, 'Cannot modify your own admin account via this endpoint');

      const body = UpdateAdminSchema.parse(req.body);
      if (body.isActive === undefined && body.roles === undefined) {
        throw httpError(400, 'No changes provided');
      }

      const client = await app.db.connect();
      try {
        await client.query('begin');

        if (typeof body.isActive === 'boolean') {
          await client.query(
            `update users set is_active = $2 where id = $1 and user_type = 'ADMIN'`,
            [targetId, body.isActive]
          );
        }

        if (body.roles) {
          const roleRows = await client.query<{ id: string; name: string }>(
            'select id, name from admin_roles where name = any($1::text[])',
            [body.roles]
          );
          if (roleRows.rowCount !== body.roles.length) {
            throw httpError(400, 'One or more roles are invalid');
          }

          await client.query('delete from admin_user_roles where user_id = $1', [targetId]);
          for (const role of roleRows.rows) {
            await client.query(
              `insert into admin_user_roles(user_id, role_id)
               values ($1, $2)
               on conflict do nothing`,
              [targetId, role.id]
            );
          }
        }

        await client.query('commit');
        return reply.send({ ok: true });
      } catch (e) {
        await client.query('rollback');
        throw e;
      } finally {
        client.release();
      }
    }
  );

  app.delete(
    '/admin/admins/:id',
    {
      schema: {
        tags: ['Admin Management'],
        summary: 'Deactivate an admin user (soft delete)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          additionalProperties: false,
          properties: {
            id: { type: 'string' }
          }
        },
        response: {
          200: {
            type: 'object',
            required: ['ok'],
            additionalProperties: false,
            properties: { ok: { type: 'boolean' } }
          }
        }
      },
      preHandler: adminAuthz(app, { requiredPermission: 'admin.admins.manage' })
    },
    async (req, reply) => {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) throw httpError(401, 'Missing bearer token');
      const payload = await app.jwt.verify(authHeader.substring(7), { aud, typ: 'access' });
      const actorId = String(payload.sub);

      const targetId = String((req.params as any).id);
      if (!targetId) throw httpError(400, 'Missing id');
      if (targetId === actorId) throw httpError(400, 'Cannot delete your own admin account');

      await app.db.query(`update users set is_active = false where id = $1 and user_type = 'ADMIN'`, [targetId]);
      return reply.send({ ok: true });
    }
  );
}
