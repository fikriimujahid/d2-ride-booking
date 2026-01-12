import type { FastifyInstance } from 'fastify';
import { withTx } from '../../db/tx.js';
import { httpError } from '../../util/httpErrors.js';
import { tryAcquireLock } from '../../redis/lock.js';

type LatLng = { lat: number; lng: number };

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function boundingBox(p: LatLng, radiusM: number) {
  // Approximate bounding box for candidate prefilter.
  const earthRadiusM = 6371000;
  const latRad = (p.lat * Math.PI) / 180;

  const dLat = radiusM / earthRadiusM;
  const dLng = radiusM / (earthRadiusM * Math.cos(latRad));

  const minLat = p.lat - (dLat * 180) / Math.PI;
  const maxLat = p.lat + (dLat * 180) / Math.PI;
  const minLng = p.lng - (dLng * 180) / Math.PI;
  const maxLng = p.lng + (dLng * 180) / Math.PI;

  return { minLat, maxLat, minLng, maxLng };
}

export type MatchOptions = {
  maxWaitMs: number;
  initialRadiusM: number;
  maxRadiusM: number;
  radiusMultiplier: number;
  candidatesPerAttempt: number;
  driverHeartbeatMaxAgeSeconds: number;
  offerTtlMs: number;
  pollEveryMs: number;
};

export const DEFAULT_MATCH_OPTIONS: MatchOptions = {
  maxWaitMs: 25_000,
  initialRadiusM: 1_500,
  maxRadiusM: 10_000,
  radiusMultiplier: 1.7,
  candidatesPerAttempt: 50,
  driverHeartbeatMaxAgeSeconds: 30,
  offerTtlMs: 8_000,
  pollEveryMs: 500
};

type CandidateRow = {
  id: string;
  dist_m: number;
};

async function getRidePickup(app: FastifyInstance, rideId: string): Promise<LatLng> {
  const ride = await app.db.query<{ pickup: unknown }>('select pickup from rides where id = $1', [rideId]);
  if (ride.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');

  const pickup = ride.rows[0]!.pickup as { lat?: unknown; lng?: unknown };
  const lat = typeof pickup?.lat === 'number' ? pickup.lat : Number(pickup?.lat);
  const lng = typeof pickup?.lng === 'number' ? pickup.lng : Number(pickup?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw httpError(409, 'CONFLICT', 'Ride pickup is missing lat/lng');
  }

  return { lat, lng };
}

async function selectCandidates(
  app: FastifyInstance,
  pickup: LatLng,
  radiusM: number,
  heartbeatMaxAgeSeconds: number,
  limit: number
): Promise<CandidateRow[]> {
  const box = boundingBox(pickup, radiusM);

  // Haversine-ish distance (spherical law of cosines) in SQL for ordering.
  const q = await app.db.query<CandidateRow>(
    `select d.id,
            (6371000 * acos(
              sin(radians($1)) * sin(radians(d.current_lat)) +
              cos(radians($1)) * cos(radians(d.current_lat)) * cos(radians(d.current_lng) - radians($2))
            )) as dist_m
       from drivers d
      where d.is_available = true
        and d.last_seen_at is not null
        and d.last_seen_at > now() - make_interval(secs => $3)
        and d.current_lat is not null
        and d.current_lng is not null
        and d.current_lat between $4 and $5
        and d.current_lng between $6 and $7
      order by dist_m asc
      limit $8`,
    [pickup.lat, pickup.lng, heartbeatMaxAgeSeconds, box.minLat, box.maxLat, box.minLng, box.maxLng, limit]
  );

  // Defensive: filter any NaN distances
  return q.rows.filter((r) => Number.isFinite(r.dist_m));
}

async function expireIfNeeded(app: FastifyInstance, rideId: string) {
  await app.db.query(
    `update rides
        set status = 'requested',
            offered_driver_id = null,
            offer_expires_at = null,
            updated_at = now()
      where id = $1
        and status = 'offered'
        and offer_expires_at is not null
        and offer_expires_at < now()`,
    [rideId]
  );
}

export async function matchRideToDriver(app: FastifyInstance, rideId: string, opts?: Partial<MatchOptions>) {
  if (!app.redis) throw httpError(500, 'INTERNAL_ERROR', 'Redis is not configured');

  const options: MatchOptions = { ...DEFAULT_MATCH_OPTIONS, ...(opts ?? {}) };
  options.maxWaitMs = clamp(options.maxWaitMs, 1_000, 120_000);
  options.offerTtlMs = clamp(options.offerTtlMs, 1_000, 60_000);

  const rideLock = await tryAcquireLock(app.redis, `lock:ride:${rideId}`, Math.min(options.maxWaitMs + 5_000, 180_000));
  if (!rideLock) throw httpError(409, 'CONFLICT', 'Ride is already being matched');

  try {
    const startedAt = Date.now();
    const pickup = await getRidePickup(app, rideId);

    let radiusM = options.initialRadiusM;

    while (Date.now() - startedAt < options.maxWaitMs) {
      await expireIfNeeded(app, rideId);

      const statusRes = await app.db.query<{ status: string; driver_id: string | null; offered_driver_id: string | null }>(
        'select status, driver_id, offered_driver_id from rides where id = $1',
        [rideId]
      );
      if (statusRes.rowCount === 0) throw httpError(404, 'NOT_FOUND', 'Ride not found');
      const ride = statusRes.rows[0]!;

      if (ride.status === 'accepted') {
        return { rideId, status: 'accepted', driverId: ride.driver_id };
      }

      // If some other worker already offered, just wait for it to resolve or expire.
      if (ride.status === 'offered') {
        await sleep(options.pollEveryMs);
        continue;
      }

      if (ride.status !== 'requested') {
        throw httpError(409, 'CONFLICT', `Ride is not matchable in status ${ride.status}`);
      }

      const candidates = await selectCandidates(
        app,
        pickup,
        radiusM,
        options.driverHeartbeatMaxAgeSeconds,
        options.candidatesPerAttempt
      );

      for (const c of candidates) {
        const remaining = options.maxWaitMs - (Date.now() - startedAt);
        if (remaining <= 0) break;

        const driverLock = await tryAcquireLock(app.redis, `lock:driver:${c.id}`, options.offerTtlMs + 2_000);
        if (!driverLock) continue;

        // Attempt to write the offer in Postgres (source of truth)
        const offered = await withTx(app.db, async (client) => {
          try {
            const updated = await client.query<{ id: string; status: string; offered_driver_id: string | null; offer_expires_at: string | null }>(
              `update rides
                  set status = 'offered',
                      offered_driver_id = $2,
                      offer_expires_at = now() + make_interval(secs => $3),
                      updated_at = now()
                where id = $1
                  and status = 'requested'
                  and driver_id is null
                  and offered_driver_id is null
                  and exists (
                    select 1
                      from drivers d
                     where d.id = $2
                       and d.is_available = true
                       and d.last_seen_at is not null
                       and d.last_seen_at > now() - make_interval(secs => $4)
                  )
                returning id, status, offered_driver_id, offer_expires_at`,
              [rideId, c.id, Math.ceil(options.offerTtlMs / 1000), options.driverHeartbeatMaxAgeSeconds]
            );

            if (updated.rowCount === 0) return null;
            return updated.rows[0]!;
          } catch (err) {
            // Unique violations mean the driver is already busy/offered.
            // Treat as a normal miss and keep searching.
            return null;
          }
        });

        if (!offered) {
          await driverLock.release();
          continue;
        }

        // Wait for acceptance (or expiry)
        const offerDeadline = Date.now() + Math.min(options.offerTtlMs, remaining);
        while (Date.now() < offerDeadline) {
          const r = await app.db.query<{ status: string; driver_id: string | null; offered_driver_id: string | null }>(
            'select status, driver_id, offered_driver_id from rides where id = $1',
            [rideId]
          );
          const row = r.rows[0]!;

          if (row.status === 'accepted' && row.driver_id === c.id) {
            await driverLock.release();
            return { rideId, status: 'accepted', driverId: row.driver_id };
          }

          await sleep(options.pollEveryMs);
        }

        // Let DB expire & clear offer; release lock early.
        await expireIfNeeded(app, rideId);
        await driverLock.release();
      }

      radiusM = Math.min(options.maxRadiusM, radiusM * options.radiusMultiplier);
      await sleep(200);
    }

    throw httpError(504, 'TIMEOUT', 'No driver accepted within matching timeout');
  } finally {
    await rideLock.release();
  }
}
