import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/authContext.js';

export async function registerPassengerRoutes(app: FastifyInstance) {
  app.get('/passengers/me', {
    schema: {
      tags: ['Passenger'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            passengerId: { type: 'string' },
            authSubjectId: { type: 'string' },
            fullName: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            createdAt: { type: 'string' }
          },
          required: ['passengerId', 'authSubjectId', 'createdAt']
        }
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'passenger');

    const result = await app.db.query(
      `select id, auth_subject_id, full_name, phone, created_at
       from passengers
       where auth_subject_id = $1`,
      [auth.subjectId]
    );

    if (result.rowCount === 0) {
      // auto-provision minimal record
      const created = await app.db.query(
        `insert into passengers(auth_subject_id) values ($1)
         on conflict (auth_subject_id) do update set auth_subject_id = excluded.auth_subject_id
         returning id, auth_subject_id, full_name, phone, created_at`,
        [auth.subjectId]
      );
      const row = created.rows[0];
      return {
        passengerId: row.id,
        authSubjectId: row.auth_subject_id,
        fullName: row.full_name,
        phone: row.phone,
        createdAt: row.created_at
      };
    }

    const row = result.rows[0];
    return {
      passengerId: row.id,
      authSubjectId: row.auth_subject_id,
      fullName: row.full_name,
      phone: row.phone,
      createdAt: row.created_at
    };
  });

  app.patch('/passengers/me', {
    schema: {
      tags: ['Passenger'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 1 },
          phone: { type: 'string', minLength: 7 }
        },
        additionalProperties: false
      },
      response: {
        200: {
          type: 'object',
          properties: {
            passengerId: { type: 'string' },
            fullName: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            updatedAt: { type: 'string' }
          },
          required: ['passengerId', 'updatedAt']
        }
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'passenger');

    const body = (req.body ?? {}) as { fullName?: string; phone?: string };

    const updated = await app.db.query(
      `update passengers
       set full_name = coalesce($2, full_name),
           phone = coalesce($3, phone),
           updated_at = now()
       where auth_subject_id = $1
       returning id, full_name, phone, updated_at`,
      [auth.subjectId, body.fullName ?? null, body.phone ?? null]
    );

    if (updated.rowCount === 0) {
      // ensure record exists then retry update
      await app.db.query(`insert into passengers(auth_subject_id) values ($1) on conflict do nothing`, [auth.subjectId]);
      const updated2 = await app.db.query(
        `update passengers
         set full_name = coalesce($2, full_name),
             phone = coalesce($3, phone),
             updated_at = now()
         where auth_subject_id = $1
         returning id, full_name, phone, updated_at`,
        [auth.subjectId, body.fullName ?? null, body.phone ?? null]
      );
      const row = updated2.rows[0];
      return { passengerId: row.id, fullName: row.full_name, phone: row.phone, updatedAt: row.updated_at };
    }

    const row = updated.rows[0];
    return { passengerId: row.id, fullName: row.full_name, phone: row.phone, updatedAt: row.updated_at };
  });
}
