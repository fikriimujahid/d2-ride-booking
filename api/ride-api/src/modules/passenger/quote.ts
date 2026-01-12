import crypto from 'node:crypto';
import type { RedisClientType } from 'redis';

export type LatLng = { lat: number; lng: number };

export type QuoteRequest = {
  pickup: LatLng;
  dropoff: LatLng;
  currency?: string;
};

export type QuoteBreakdown = {
  baseFareCents: number;
  distanceFareCents: number;
  timeFareCents: number;
  bookingFeeCents: number;
  subtotalCents: number;
  minimumFareCents: number;
  surgeMultiplier: number;
  totalCents: number;
};

export type QuoteResponse = {
  quoteId: string;
  currency: string;
  totalCents: number;
  breakdown: QuoteBreakdown;
  distanceMeters: number;
  durationSeconds: number;
  etaSeconds: number;
  estimated: boolean;
  expiresAt: string;
};

export type QuoteDeps = {
  redis?: Pick<RedisClientType, 'get' | 'set'>;
  fetchImpl?: typeof fetch;
  nowMs?: () => number;
  googleMapsApiKey?: string;
  googleMapsTimeoutMs?: number;
};

type DistanceMatrixOk = {
  kind: 'ok';
  distanceMeters: number;
  durationSeconds: number;
};

type DistanceMatrixErr = {
  kind: 'error';
  message: string;
};

type DistanceMatrixResult = DistanceMatrixOk | DistanceMatrixErr;

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function roundCoord(n: number, decimals: number): number {
  const m = 10 ** decimals;
  return Math.round(n * m) / m;
}

function cacheKey(pickup: LatLng, dropoff: LatLng, nowMs: number): string {
  const pLat = roundCoord(pickup.lat, 3);
  const pLng = roundCoord(pickup.lng, 3);
  const dLat = roundCoord(dropoff.lat, 3);
  const dLng = roundCoord(dropoff.lng, 3);
  const bucket = Math.floor(nowMs / (5 * 60 * 1000));
  return `quote:dm:${pLat},${pLng}:${dLat},${dLng}:${bucket}`;
}

function haversineDistanceMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLng / 2);
  const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calculateQuotePrice(input: {
  distanceMeters: number;
  durationSeconds: number;
  surgeMultiplier?: number;
}): QuoteBreakdown {
  const distanceKm = Math.max(0, input.distanceMeters) / 1000;
  const durationMin = Math.max(0, input.durationSeconds) / 60;
  const surgeMultiplier = clamp(input.surgeMultiplier ?? 1, 1, 3);

  // Simple baseline pricing in cents. Tune per market/service level.
  const baseFareCents = 200;
  const bookingFeeCents = 50;
  const perKmCents = 120;
  const perMinCents = 30;
  const minimumFareCents = 500;

  const distanceFareCents = Math.round(perKmCents * distanceKm);
  const timeFareCents = Math.round(perMinCents * durationMin);

  const subtotalCents = baseFareCents + bookingFeeCents + distanceFareCents + timeFareCents;
  const surged = Math.round(subtotalCents * surgeMultiplier);
  const totalCents = Math.max(minimumFareCents, surged);

  return {
    baseFareCents,
    distanceFareCents,
    timeFareCents,
    bookingFeeCents,
    subtotalCents,
    minimumFareCents,
    surgeMultiplier,
    totalCents
  };
}

async function fetchGoogleDistanceMatrix(params: {
  pickup: LatLng;
  dropoff: LatLng;
  apiKey: string;
  timeoutMs: number;
  fetchImpl: typeof fetch;
}): Promise<DistanceMatrixResult> {
  const { pickup, dropoff, apiKey, timeoutMs, fetchImpl } = params;

  const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
  url.searchParams.set('origins', `${pickup.lat},${pickup.lng}`);
  url.searchParams.set('destinations', `${dropoff.lat},${dropoff.lng}`);
  url.searchParams.set('departure_time', 'now');
  url.searchParams.set('traffic_model', 'best_guess');
  url.searchParams.set('key', apiKey);

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetchImpl(url, { signal: controller.signal });
    if (!res.ok) {
      return { kind: 'error', message: `distance-matrix http ${res.status}` };
    }

    const json = (await res.json()) as {
      status?: string;
      rows?: Array<{ elements?: Array<{ status?: string; distance?: { value?: number }; duration?: { value?: number }; duration_in_traffic?: { value?: number } }> }>;
    };

    if (json.status !== 'OK') {
      return { kind: 'error', message: `distance-matrix status ${String(json.status)}` };
    }

    const el = json.rows?.[0]?.elements?.[0];
    if (!el || el.status !== 'OK') {
      return { kind: 'error', message: `distance-matrix element ${String(el?.status)}` };
    }

    const distanceMeters = Number(el.distance?.value);
    const durationSeconds = Number(el.duration_in_traffic?.value ?? el.duration?.value);

    if (!Number.isFinite(distanceMeters) || !Number.isFinite(durationSeconds)) {
      return { kind: 'error', message: 'distance-matrix missing fields' };
    }

    return {
      kind: 'ok',
      distanceMeters: Math.max(0, Math.round(distanceMeters)),
      durationSeconds: Math.max(0, Math.round(durationSeconds))
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'fetch error';
    return { kind: 'error', message: msg };
  } finally {
    clearTimeout(t);
  }
}

function fallbackDistanceAndDuration(pickup: LatLng, dropoff: LatLng): { distanceMeters: number; durationSeconds: number } {
  // Conservative fallback: straight-line distance, scaled up to approximate roads.
  const straight = haversineDistanceMeters(pickup, dropoff);
  const roadFactor = 1.25;
  const distanceMeters = Math.round(straight * roadFactor);

  // Conservative urban speed estimate.
  const speedMps = 22_000 / 3600; // 22 km/h
  const baseDuration = distanceMeters / speedMps;
  const trafficUncertainty = 1.3;
  const durationSeconds = Math.max(60, Math.round(baseDuration * trafficUncertainty));

  return { distanceMeters, durationSeconds };
}

export async function createPassengerQuote(input: QuoteRequest, deps: QuoteDeps): Promise<QuoteResponse> {
  const currency = (input.currency ?? 'USD').toUpperCase();
  const nowMs = deps.nowMs ?? (() => Date.now());
  const fetchImpl = deps.fetchImpl ?? fetch;

  const redis = deps.redis;
  const key = cacheKey(input.pickup, input.dropoff, nowMs());

  if (redis) {
    try {
      const cached = await redis.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as { distanceMeters: number; durationSeconds: number };
        if (Number.isFinite(parsed.distanceMeters) && Number.isFinite(parsed.durationSeconds)) {
          const breakdown = calculateQuotePrice({
            distanceMeters: parsed.distanceMeters,
            durationSeconds: parsed.durationSeconds
          });

          const expiresAt = new Date(nowMs() + 2 * 60 * 1000).toISOString();
          return {
            quoteId: crypto.randomUUID(),
            currency,
            totalCents: breakdown.totalCents,
            breakdown,
            distanceMeters: parsed.distanceMeters,
            durationSeconds: parsed.durationSeconds,
            etaSeconds: parsed.durationSeconds,
            estimated: false,
            expiresAt
          };
        }
      }
    } catch {
      // Ignore cache issues and fall back to live calculation.
    }
  }

  let distanceMeters: number;
  let durationSeconds: number;
  let estimated = false;

  const apiKey = deps.googleMapsApiKey;
  const timeoutMs = deps.googleMapsTimeoutMs ?? 2000;

  if (apiKey) {
    const dm = await fetchGoogleDistanceMatrix({
      pickup: input.pickup,
      dropoff: input.dropoff,
      apiKey,
      timeoutMs,
      fetchImpl
    });

    if (dm.kind === 'ok') {
      distanceMeters = dm.distanceMeters;
      durationSeconds = dm.durationSeconds;

      if (redis) {
        try {
          await redis.set(key, JSON.stringify({ distanceMeters, durationSeconds }), { PX: 120_000 });
        } catch {
          // ignore cache write errors
        }
      }
    } else {
      const fallback = fallbackDistanceAndDuration(input.pickup, input.dropoff);
      distanceMeters = fallback.distanceMeters;
      durationSeconds = fallback.durationSeconds;
      estimated = true;
    }
  } else {
    const fallback = fallbackDistanceAndDuration(input.pickup, input.dropoff);
    distanceMeters = fallback.distanceMeters;
    durationSeconds = fallback.durationSeconds;
    estimated = true;
  }

  const breakdown = calculateQuotePrice({ distanceMeters, durationSeconds });
  const expiresAt = new Date(nowMs() + 2 * 60 * 1000).toISOString();

  return {
    quoteId: crypto.randomUUID(),
    currency,
    totalCents: breakdown.totalCents,
    breakdown,
    distanceMeters,
    durationSeconds,
    etaSeconds: durationSeconds,
    estimated,
    expiresAt
  };
}
