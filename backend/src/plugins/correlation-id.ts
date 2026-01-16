/**
 * CORRELATION ID PLUGIN
 *
 * Goal: Provide a stable “flow id” that can represent a single user action
 * across multiple concurrent HTTP requests.
 *
 * OpenTelemetry concept mapping:
 * - correlationId ~= “trace id” *at the application boundary*
 *   (not a full tracing implementation, but the same idea: one id to tie work together)
 *
 * Behavior:
 * - Read `x-correlation-id` from inbound request headers if provided.
 * - Sanitize it (allowed characters + length limit).
 * - If missing/invalid, generate a UUID v4.
 * - Store it on `request.correlationId` (request-scoped, concurrency-safe).
 * - Always return it on the response as `x-correlation-id`.
 * - Bind it to `request.log` / `reply.log` so every log line emitted during
 *   this request automatically includes the correlation id.
 */

import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

const CORRELATION_ID_HEADER = 'x-correlation-id' as const;

// Industry-standard-ish constraints:
// - Keep it short enough for logs/DB indexes
// - Allow common id-safe chars
// - Remove everything else (prevents log injection / weird parsing)
const MAX_CORRELATION_ID_LEN = 128;
const MIN_CORRELATION_ID_LEN = 8;
const ALLOWED_CHARS = /[^a-zA-Z0-9._-]/g;

function safeString(value: unknown, maxLen = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function normalizeCorrelationId(value: unknown): string | undefined {
  const raw = safeString(value, MAX_CORRELATION_ID_LEN);
  if (!raw) return undefined;

  // Strip disallowed characters and clamp length.
  const cleaned = raw.replace(ALLOWED_CHARS, '').slice(0, MAX_CORRELATION_ID_LEN);
  if (cleaned.length < MIN_CORRELATION_ID_LEN) return undefined;

  return cleaned;
}

function generateCorrelationId(): string {
  // crypto.randomUUID() is UUID v4 and safe for high-concurrency.
  try {
    return randomUUID();
  } catch {
    // Extremely defensive fallback.
    return String(Date.now());
  }
}

function readInboundCorrelationId(request: FastifyRequest): string | undefined {
  // Fastify lower-cases header keys.
  const headerValue = request.headers[CORRELATION_ID_HEADER];

  // Header may be string or string[]. We accept the first item.
  const first = Array.isArray(headerValue) ? headerValue[0] : headerValue;
  return normalizeCorrelationId(first);
}

export const correlationIdPlugin: FastifyPluginAsync = fp(
  async (app) => {
    // Declare the request property at runtime so it exists on request.
    // TypeScript type is provided via src/types/fastify.d.ts module augmentation.
    app.decorateRequest('correlationId', '');

    app.addHook('onRequest', async (request, reply) => {
      // 1) Take inbound correlation id if present + valid
      // 2) Otherwise generate new UUID v4
      const correlationId = readInboundCorrelationId(request) ?? generateCorrelationId();

      // Store on request so it’s accessible everywhere during this lifecycle.
      request.correlationId = correlationId;

      // Always propagate back to client.
      reply.header(CORRELATION_ID_HEADER, correlationId);

      // Bind correlationId to request-scoped loggers.
      // This prevents cross-request mixing under concurrency.
      request.log = request.log.child({ correlationId });
      reply.log = reply.log.child({ correlationId });
    });
  },
  { name: 'correlation-id-plugin' }
);
