import type { FastifyInstance } from 'fastify';
import { httpError } from '../../util/httpErrors.js';
import { requireAuth, requireRole } from '../../plugins/authContext.js';
import { withTx } from '../../db/tx.js';
import { matchRideToDriver } from '../matching/driverMatching.js';
import {
  decideAccept,
  decideArrive,
  decideCancel,
  decideComplete,
  decideStart,
  type RideStatus
} from './lifecycle.js';

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
  offered_driver_id?: string | null;
  offer_expires_at?: string | null;
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
      offeredDriverId: (row as RideRowBase).offered_driver_id ?? null,
      offerExpiresAt: (row as RideRowBase).offer_expires_at ?? null,
      pickup: row.pickup,
      dropoff: row.dropoff,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  });

  app.post('/rides/:rideId/match', {
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
        properties: {
          maxWaitMs: { type: 'number' },
          initialRadiusM: { type: 'number' },
          maxRadiusM: { type: 'number' },
          offerTtlMs: { type: 'number' }
        },
        additionalProperties: false
      }
    }
  }, async (req) => {
    requireRole(req, 'system');
    const { rideId } = req.params as { rideId: string };
    const body = (req.body ?? {}) as {
      maxWaitMs?: number;
      initialRadiusM?: number;
      maxRadiusM?: number;
      offerTtlMs?: number;
    };
    return await matchRideToDriver(req.server, rideId, body);
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

    return await withTx(app.db, async (client) => {
      const driver = await client.query<{ id: string; is_available: boolean }>(
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

      const ride = await client.query<Pick<RideRowBase, 'id' | 'status' | 'passenger_id' | 'driver_id' | 'offered_driver_id'>>(
        `select id, status, passenger_id, driver_id, offered_driver_id
           from rides
          where id = $1
          for update`,
        [rideId]
      );

      if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

      const row = ride.rows[0]!;
      const decision = decideAccept(row.status as RideStatus, row.driver_id ?? row.offered_driver_id ?? null, driverId);

      if (decision.kind === 'idempotent') {
        return { rideId: row.id, status: 'accepted', passengerId: row.passenger_id, driverId: row.driver_id };
      }

      if (decision.kind === 'conflict') {
        throw httpError(409, 'CONFLICT', decision.message);
      }

      const updated = await client.query<Pick<RideRowBase, 'id' | 'status' | 'passenger_id' | 'driver_id'>>(
        `update rides
            set driver_id = $2,
                offered_driver_id = null,
                offer_expires_at = null,
                assigned_at = now(),
                status = 'accepted',
                updated_at = now()
          where id = $1
            and (
              (status = 'requested' and driver_id is null and offered_driver_id is null)
              or (status = 'offered' and driver_id is null and offered_driver_id = $2 and offer_expires_at is not null and offer_expires_at > now())
            )
          returning id, status, passenger_id, driver_id`,
        [rideId, driverId]
      );

      if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride is not available to accept');

      const updatedRow = updated.rows[0]!;
      return {
        rideId: updatedRow.id,
        status: updatedRow.status,
        passengerId: updatedRow.passenger_id,
        driverId: updatedRow.driver_id
      };
    });
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

    return await withTx(app.db, async (client) => {
      const ride = await client.query<{
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
          where r.id = $1
          for update of r`,
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

      const decision = decideCancel(row.status as RideStatus);
      if (decision.kind === 'idempotent') return { rideId, status: 'cancelled' };
      if (decision.kind === 'conflict') throw httpError(409, 'CONFLICT', decision.message);

      const updated = await client.query(
        `update rides
            set status = 'cancelled',
                offered_driver_id = null,
                offer_expires_at = null,
                cancelled_at = now(),
                cancelled_reason = $2,
                updated_at = now()
          where id = $1
            and status in ('requested', 'offered', 'accepted', 'arrived')
          returning id, status`,
        [rideId, body.reason ?? null]
      );

      if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride cannot be cancelled in current state');
      return { rideId, status: 'cancelled' };
    });
  });

  app.post('/rides/:rideId/arrive', {
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

    return await withTx(app.db, async (client) => {
      const driver = await client.query<{ id: string }>('select id from drivers where auth_subject_id = $1', [
        auth.subjectId
      ]);
      if (driver.rowCount === 0) throw httpError(409, 'CONFLICT', 'Driver profile not found');
      const driverId = driver.rows[0]!.id;

      const ride = await client.query<Pick<RideRowBase, 'id' | 'status' | 'driver_id'>>(
        `select id, status, driver_id
           from rides
          where id = $1
          for update`,
        [rideId]
      );
      if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

      const row = ride.rows[0]!;
      const decision = decideArrive(row.status as RideStatus, row.driver_id, driverId);
      if (decision.kind === 'idempotent') return { rideId, status: 'arrived' };
      if (decision.kind === 'conflict') throw httpError(409, 'CONFLICT', decision.message);

      const updated = await client.query(
        `update rides
            set status = 'arrived',
                arrived_at = now(),
                updated_at = now()
          where id = $1
            and status = 'accepted'
            and driver_id = $2
          returning id, status`,
        [rideId, driverId]
      );

      if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride cannot be marked arrived in current state');
      return { rideId, status: 'arrived' };
    });
  });

  app.post('/rides/:rideId/start', {
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

    return await withTx(app.db, async (client) => {
      const driver = await client.query<{ id: string }>('select id from drivers where auth_subject_id = $1', [
        auth.subjectId
      ]);
      if (driver.rowCount === 0) throw httpError(409, 'CONFLICT', 'Driver profile not found');
      const driverId = driver.rows[0]!.id;

      const ride = await client.query<Pick<RideRowBase, 'id' | 'status' | 'driver_id'>>(
        `select id, status, driver_id
           from rides
          where id = $1
          for update`,
        [rideId]
      );
      if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

      const row = ride.rows[0]!;
      const decision = decideStart(row.status as RideStatus, row.driver_id, driverId);
      if (decision.kind === 'idempotent') return { rideId, status: 'in_progress' };
      if (decision.kind === 'conflict') throw httpError(409, 'CONFLICT', decision.message);

      const updated = await client.query(
        `update rides
            set status = 'in_progress',
                started_at = now(),
                updated_at = now()
          where id = $1
            and status = 'arrived'
            and driver_id = $2
          returning id, status`,
        [rideId, driverId]
      );

      if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride cannot be started in current state');
      return { rideId, status: 'in_progress' };
    });
  });

  app.post('/rides/:rideId/complete', {
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

    return await withTx(app.db, async (client) => {
      const driver = await client.query<{ id: string }>('select id from drivers where auth_subject_id = $1', [
        auth.subjectId
      ]);
      if (driver.rowCount === 0) throw httpError(409, 'CONFLICT', 'Driver profile not found');
      const driverId = driver.rows[0]!.id;

      const ride = await client.query<Pick<RideRowBase, 'id' | 'status' | 'driver_id'>>(
        `select id, status, driver_id
           from rides
          where id = $1
          for update`,
        [rideId]
      );
      if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

      const row = ride.rows[0]!;
      const decision = decideComplete(row.status as RideStatus, row.driver_id, driverId);
      if (decision.kind === 'idempotent') return { rideId, status: 'completed' };
      if (decision.kind === 'conflict') throw httpError(409, 'CONFLICT', decision.message);

      const updated = await client.query(
        `update rides
            set status = 'completed',
                completed_at = now(),
                updated_at = now()
          where id = $1
            and status = 'in_progress'
            and driver_id = $2
          returning id, status`,
        [rideId, driverId]
      );

      if (updated.rowCount === 0) throw httpError(409, 'CONFLICT', 'Ride cannot be completed in current state');
      return { rideId, status: 'completed' };
    });
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
