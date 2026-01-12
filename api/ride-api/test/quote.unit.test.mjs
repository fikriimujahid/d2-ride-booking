import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calculateQuotePrice,
  createPassengerQuote
} from '../dist/modules/passenger/quote.js';

function fakeRedis({ getValue = null } = {}) {
  const calls = { get: [], set: [] };
  return {
    calls,
    redis: {
      async get(key) {
        calls.get.push(key);
        return getValue;
      },
      async set(key, value, opts) {
        calls.set.push({ key, value, opts });
        return 'OK';
      }
    }
  };
}

function makeFetchReturningDistanceMatrix({ distanceMeters, durationSeconds }) {
  return async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        status: 'OK',
        rows: [
          {
            elements: [
              {
                status: 'OK',
                distance: { value: distanceMeters },
                duration_in_traffic: { value: durationSeconds }
              }
            ]
          }
        ]
      };
    }
  });
}

test('calculateQuotePrice applies minimum fare and returns deterministic cents', () => {
  const b = calculateQuotePrice({ distanceMeters: 0, durationSeconds: 0 });
  assert.equal(b.totalCents, b.minimumFareCents);
  assert.equal(typeof b.totalCents, 'number');
});

test('createPassengerQuote uses cached distance/duration when present', async () => {
  const cached = JSON.stringify({ distanceMeters: 2500, durationSeconds: 600 });
  const { redis, calls } = fakeRedis({ getValue: cached });

  const q = await createPassengerQuote(
    {
      pickup: { lat: 1, lng: 2 },
      dropoff: { lat: 3, lng: 4 },
      currency: 'USD'
    },
    {
      redis,
      nowMs: () => 1_700_000_000_000
    }
  );

  assert.equal(calls.get.length, 1);
  assert.equal(q.distanceMeters, 2500);
  assert.equal(q.durationSeconds, 600);
  assert.equal(q.estimated, false);
  assert.equal(q.currency, 'USD');
});

test('createPassengerQuote calls Google Distance Matrix and caches result', async () => {
  const { redis, calls } = fakeRedis();
  const fetchImpl = makeFetchReturningDistanceMatrix({ distanceMeters: 12345, durationSeconds: 987 });

  const q = await createPassengerQuote(
    {
      pickup: { lat: 10.12345, lng: 20.12345 },
      dropoff: { lat: 10.22345, lng: 20.22345 }
    },
    {
      redis,
      fetchImpl,
      googleMapsApiKey: 'test-key',
      googleMapsTimeoutMs: 2000,
      nowMs: () => 1_700_000_000_000
    }
  );

  assert.equal(q.distanceMeters, 12345);
  assert.equal(q.durationSeconds, 987);
  assert.equal(q.estimated, false);
  assert.equal(calls.set.length, 1);
});

test('createPassengerQuote falls back to estimated values when Google fails', async () => {
  const fetchImpl = async () => {
    throw new Error('network down');
  };

  const q = await createPassengerQuote(
    {
      pickup: { lat: 37.7749, lng: -122.4194 },
      dropoff: { lat: 37.7849, lng: -122.4094 }
    },
    {
      fetchImpl,
      googleMapsApiKey: 'test-key',
      nowMs: () => 1_700_000_000_000
    }
  );

  assert.equal(q.estimated, true);
  assert.ok(q.distanceMeters > 0);
  assert.ok(q.durationSeconds >= 60);
});
