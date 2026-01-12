import type { FastifyInstance } from 'fastify';
import { requireRole } from '../../plugins/authContext.js';

export async function registerDriverRoutes(app: FastifyInstance) {
  app.get('/drivers/me', {
    schema: {
      tags: ['Driver'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            driverId: { type: 'string' },
            authSubjectId: { type: 'string' },
            fullName: { type: ['string', 'null'] },
            phone: { type: ['string', 'null'] },
            isAvailable: { type: 'boolean' },
            createdAt: { type: 'string' }
          },
          required: ['driverId', 'authSubjectId', 'isAvailable', 'createdAt']
        }
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'driver');

    const result = await app.db.query(
      `select id, auth_subject_id, full_name, phone, is_available, created_at
       from drivers
       where auth_subject_id = $1`,
      [auth.subjectId]
    );

    if (result.rowCount === 0) {
      const created = await app.db.query(
        `insert into drivers(auth_subject_id) values ($1)
         on conflict (auth_subject_id) do update set auth_subject_id = excluded.auth_subject_id
         returning id, auth_subject_id, full_name, phone, is_available, created_at`,
        [auth.subjectId]
      );
      const row = created.rows[0];
      return {
        driverId: row.id,
        authSubjectId: row.auth_subject_id,
        fullName: row.full_name,
        phone: row.phone,
        isAvailable: row.is_available,
        createdAt: row.created_at
      };
    }

    const row = result.rows[0];
    return {
      driverId: row.id,
      authSubjectId: row.auth_subject_id,
      fullName: row.full_name,
      phone: row.phone,
      isAvailable: row.is_available,
      createdAt: row.created_at
    };
  });

  app.patch('/drivers/me', {
    schema: {
      tags: ['Driver'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          fullName: { type: 'string', minLength: 1 },
          phone: { type: 'string', minLength: 7 }
        },
        additionalProperties: false
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'driver');
    const body = (req.body ?? {}) as { fullName?: string; phone?: string };

    await app.db.query(`insert into drivers(auth_subject_id) values ($1) on conflict do nothing`, [auth.subjectId]);

    const updated = await app.db.query(
      `update drivers
       set full_name = coalesce($2, full_name),
           phone = coalesce($3, phone),
           updated_at = now()
       where auth_subject_id = $1
       returning id, full_name, phone, is_available, updated_at`,
      [auth.subjectId, body.fullName ?? null, body.phone ?? null]
    );

    const row = updated.rows[0];
    return {
      driverId: row.id,
      fullName: row.full_name,
      phone: row.phone,
      isAvailable: row.is_available,
      updatedAt: row.updated_at
    };
  });

  app.patch('/drivers/me/availability', {
    schema: {
      tags: ['Driver'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          isAvailable: { type: 'boolean' }
        },
        required: ['isAvailable'],
        additionalProperties: false
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'driver');
    const body = req.body as { isAvailable: boolean };

    await app.db.query(`insert into drivers(auth_subject_id) values ($1) on conflict do nothing`, [auth.subjectId]);

    const updated = await app.db.query(
      `update drivers
       set is_available = $2,
           updated_at = now()
       where auth_subject_id = $1
       returning id, is_available, updated_at`,
      [auth.subjectId, body.isAvailable]
    );

    const row = updated.rows[0];
    return { driverId: row.id, isAvailable: row.is_available, updatedAt: row.updated_at };
  });

  app.patch('/drivers/me/location', {
    schema: {
      tags: ['Driver'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          lat: { type: 'number' },
          lng: { type: 'number' }
        },
        required: ['lat', 'lng'],
        additionalProperties: false
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'driver');
    const body = req.body as { lat: number; lng: number };

    await app.db.query(`insert into drivers(auth_subject_id) values ($1) on conflict do nothing`, [auth.subjectId]);

    const updated = await app.db.query(
      `update drivers
          set current_lat = $2,
              current_lng = $3,
              last_seen_at = now(),
              updated_at = now()
        where auth_subject_id = $1
        returning id, current_lat, current_lng, last_seen_at`,
      [auth.subjectId, body.lat, body.lng]
    );

    const row = updated.rows[0];
    return { driverId: row.id, lat: row.current_lat, lng: row.current_lng, lastSeenAt: row.last_seen_at };
  });
}
