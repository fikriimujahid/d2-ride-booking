import type { FastifyInstance } from 'fastify';
import { httpError } from '../../util/httpErrors.js';
import { requireAuth, requireRole } from '../../plugins/authContext.js';

type Location = {
  lat: number;
  lng: number;
  address?: string;
};

type CreateRideBody = {
  pickup: Location;
  dropoff: Location;
};

type RideRowBase = {
  id: string;
  status: string;
  passenger_id: string;
  driver_id: string | null;
  pickup: unknown;
  dropoff: unknown;
  created_at: string;
  updated_at: string;
};

type RideWithAuthSubjectsRow = RideRowBase & {
  passenger_auth_subject_id: string;
  driver_auth_subject_id: string | null;
};

export async function registerRideRoutes(app: FastifyInstance) {
  app.post('/rides', {
    schema: {
      tags: ['Ride'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          pickup: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
              address: { type: 'string' }
            },
            required: ['lat', 'lng']
          },
          dropoff: {
            type: 'object',
            properties: {
              lat: { type: 'number' },
              lng: { type: 'number' },
              address: { type: 'string' }
            },
            required: ['lat', 'lng']
          }
        },
        required: ['pickup', 'dropoff'],
        additionalProperties: false
      }
    }
  }, async (req, reply) => {
    const auth = requireRole(req, 'passenger');
    const body = req.body as CreateRideBody;

    const passenger = await app.db.query<{ id: string }>('select id from passengers where auth_subject_id = $1', [
      auth.subjectId
    ]);

    const passengerId = passenger.rows?.[0]?.id;
    if (!passengerId) {
      const created = await app.db.query<{ id: string }>(
        'insert into passengers(auth_subject_id) values ($1) returning id',
        [auth.subjectId]
      );
      const createdId = created.rows[0]!.id;
      return reply.status(201).send(await createRide(app, createdId, body));
    }

    return reply.status(201).send(await createRide(app, passengerId, body));
  });

  app.get('/rides/:rideId', {
    schema: {
      tags: ['Ride'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { rideId: { type: 'string' } },
        required: ['rideId']
      }
    }
  }, async (req) => {
    const auth = requireAuth(req);
    const { rideId } = req.params as { rideId: string };

    const ride = await app.db.query<RideWithAuthSubjectsRow>(
      `select r.*,
              p.auth_subject_id as passenger_auth_subject_id,
              d.auth_subject_id as driver_auth_subject_id
         from rides r
         join passengers p on p.id = r.passenger_id
         left join drivers d on d.id = r.driver_id
        where r.id = $1`,
      [rideId]
    );

    if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

    const row = ride.rows[0]!;

    // Authorization: passenger owns ride, or driver assigned, or admin/system
    if (auth.role === 'passenger' && row.passenger_auth_subject_id !== auth.subjectId) {
      throw httpError(403, 'FORBIDDEN', 'Forbidden');
    }
    if (auth.role === 'driver' && row.driver_auth_subject_id !== auth.subjectId) {
      throw httpError(403, 'FORBIDDEN', 'Forbidden');
    }

    return {
      rideId: row.id,
      status: row.status,
      passengerId: row.passenger_id,
      driverId: row.driver_id,
      pickup: row.pickup,
      dropoff: row.dropoff,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  app.post('/rides/:rideId/accept', {
    schema: {
      tags: ['Ride'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { rideId: { type: 'string' } },
        required: ['rideId']
      }
    }
  }, async (req) => {
    const auth = requireRole(req, 'driver');
    const { rideId } = req.params as { rideId: string };

    const driver = await app.db.query<{ id: string; is_available: boolean }>(
      'select id, is_available from drivers where auth_subject_id = $1',
      [auth.subjectId]
    );

    if (driver.rowCount === 0) {
      throw httpError(409, 'CONFLICT', 'Driver profile not found');
    }
    if (!driver.rows[0]!.is_available) {
      throw httpError(409, 'CONFLICT', 'Driver is not available');
    }

    const driverId = driver.rows[0]!.id;

    const updated = await app.db.query<Pick<RideRowBase, 'id' | 'status' | 'passenger_id' | 'driver_id'>>(
      `update rides
          set driver_id = $2,
              assigned_at = now(),
              status = 'accepted',
              updated_at = now()
        where id = $1
          and status = 'requested'
          and driver_id is null
        returning id, status, passenger_id, driver_id, created_at, updated_at`,
      [rideId, driverId]
    );

    if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride is not available to accept');

    const row = updated.rows[0]!;
    return { rideId: row.id, status: row.status, passengerId: row.passenger_id, driverId: row.driver_id };
  });

  app.post('/rides/:rideId/cancel', {
    schema: {
      tags: ['Ride'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        properties: { rideId: { type: 'string' } },
        required: ['rideId']
      },
      body: {
        type: 'object',
        properties: { reason: { type: 'string' } },
        additionalProperties: false
      }
    }
  }, async (req) => {
    const auth = requireAuth(req);
    const { rideId } = req.params as { rideId: string };
    const body = (req.body ?? {}) as { reason?: string };

    const ride = await app.db.query<{
      id: string;
      status: string;
      passenger_auth_subject_id: string;
      driver_auth_subject_id: string | null;
    }>(
      `select r.id, r.status,
              p.auth_subject_id as passenger_auth_subject_id,
              d.auth_subject_id as driver_auth_subject_id
         from rides r
         join passengers p on p.id = r.passenger_id
         left join drivers d on d.id = r.driver_id
        where r.id = $1`,
      [rideId]
    );

    if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

    const row = ride.rows[0]!;

    const isPassengerOwner = auth.role === 'passenger' && row.passenger_auth_subject_id === auth.subjectId;
    const isDriverAssigned = auth.role === 'driver' && row.driver_auth_subject_id === auth.subjectId;
    const isAdminOrSystem = auth.role === 'admin' || auth.role === 'system';

    if (!isPassengerOwner && !isDriverAssigned && !isAdminOrSystem) {
      throw httpError(403, 'FORBIDDEN', 'Forbidden');
    }

    const updated = await app.db.query(
      `update rides
          set status = 'cancelled',
              cancelled_at = now(),
              cancelled_reason = $2,
              updated_at = now()
        where id = $1
          and status in ('requested', 'accepted', 'arrived')
        returning id, status`,
      [rideId, body.reason ?? null]
    );

    if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride cannot be cancelled in current state');

    return { rideId, status: 'cancelled' };
  });
}

async function createRide(app: FastifyInstance, passengerId: string, body: CreateRideBody) {
  const inserted = await app.db.query<RideRowBase>(
    `insert into rides(
        passenger_id,
        pickup,
        dropoff,
        status
     ) values ($1, $2::jsonb, $3::jsonb, 'requested')
     returning id, status, passenger_id, driver_id, pickup, dropoff, created_at, updated_at`,
    [passengerId, JSON.stringify(body.pickup), JSON.stringify(body.dropoff)]
  );

  const row = inserted.rows[0]!;
  return {
    rideId: row.id,
    status: row.status,
    passengerId: row.passenger_id,
    driverId: row.driver_id,
    pickup: row.pickup,
    dropoff: row.dropoff,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}
