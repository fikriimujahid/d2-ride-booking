import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { isAppError } from '../shared/errors.js';
import type { SanitizedAuditHttpLogRecord } from '../shared/audit-http-log.js';

const HEADER_ALLOWLIST = new Set([
  'accept',
  'content-type',
  'user-agent',
  'x-request-id',
  'x-correlation-id',
  'x-forwarded-for',
  'x-real-ip'
]);

const SENSITIVE_KEY = /(token|authorization|password|secret|otp|code|session|refresh|access)/i;
const PII_KEY = /(email|phone)/i;

const MAX_HEADER_KV = 30;
const MAX_QUERY_KV = 30;
const MAX_KEY_LEN = 80;
const MAX_HEADER_VALUE_LEN = 500;
const MAX_QUERY_VALUE_LEN = 200;
const MAX_ARRAY_ITEMS = 20;
const MAX_TOTAL_UTF8_BYTES = 4096;

function byteLen(value: string): number {
  return Buffer.byteLength(value, 'utf8');
}

function safeString(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function safeKey(rawKey: unknown): string | undefined {
  if (typeof rawKey !== 'string') return undefined;
  const k = rawKey.trim();
  if (!k) return undefined;
  if (k.length > MAX_KEY_LEN) return undefined;
  return k;
}

function normalizeRequestId(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const cleaned = trimmed.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 128);
  return cleaned.length >= 8 ? cleaned : undefined;
}

function extractFirstIp(xForwardedFor: unknown): string | null {
  const raw = Array.isArray(xForwardedFor) ? xForwardedFor.join(',') : xForwardedFor;
  const str = safeString(typeof raw === 'string' ? raw : undefined, 200);
  if (!str) return null;
  const first = str.split(',')[0]?.trim();
  return first ? first.slice(0, 128) : null;
}

function clampTotalSize<T extends Record<string, unknown> | Record<string, string>>(
  obj: T,
  maxBytes: number
): T | null {
  let total = 0;
  for (const [k, v] of Object.entries(obj)) {
    total += byteLen(k);
    if (typeof v === 'string') total += byteLen(v);
    else total += byteLen(JSON.stringify(v));
    if (total > maxBytes) return null;
  }
  return obj;
}

function sanitizeHeaders(headers: FastifyRequest['headers']): Record<string, string> | null {
  try {
    const out: Record<string, string> = {};
    let count = 0;
    for (const [rawKey, rawValue] of Object.entries(headers)) {
      if (count >= MAX_HEADER_KV) break;

      const keyRaw = safeKey(rawKey);
      if (!keyRaw) continue;

      const key = keyRaw.toLowerCase();
      if (!HEADER_ALLOWLIST.has(key)) continue;
      if (key === 'authorization' || key === 'cookie' || key === 'set-cookie') continue;

      const value = Array.isArray(rawValue) ? rawValue.join(',') : rawValue;
      const str = safeString(value, MAX_HEADER_VALUE_LEN);
      if (!str) continue;

      out[key] = str;
      count++;
    }

    if (!Object.keys(out).length) return null;
    return clampTotalSize(out, MAX_TOTAL_UTF8_BYTES);
  } catch {
    return null;
  }
}

function sanitizeQuery(query: unknown): Record<string, unknown> | null {
  if (!query || typeof query !== 'object') return null;

  try {
    const out: Record<string, string | number | boolean | readonly (string | number | boolean)[]> = {};
    let count = 0;

    for (const [rawKey, rawValue] of Object.entries(query as Record<string, unknown>)) {
      if (count >= MAX_QUERY_KV) break;

      const key = safeKey(rawKey);
      if (!key) continue;
      if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) continue;

      if (typeof rawValue === 'string') {
        const v = safeString(rawValue, MAX_QUERY_VALUE_LEN);
        if (!v) continue;
        out[key] = v;
        count++;
        continue;
      }

      if (typeof rawValue === 'number') {
        if (!Number.isFinite(rawValue)) continue;
        out[key] = rawValue;
        count++;
        continue;
      }

      if (typeof rawValue === 'boolean') {
        out[key] = rawValue;
        count++;
        continue;
      }

      if (Array.isArray(rawValue)) {
        const cleaned: (string | number | boolean)[] = [];
        for (const item of rawValue) {
          if (cleaned.length >= MAX_ARRAY_ITEMS) break;
          if (typeof item === 'string') {
            const v = safeString(item, MAX_QUERY_VALUE_LEN);
            if (v) cleaned.push(v);
            continue;
          }
          if (typeof item === 'number') {
            if (Number.isFinite(item)) cleaned.push(item);
            continue;
          }
          if (typeof item === 'boolean') {
            cleaned.push(item);
            continue;
          }
        }
        if (!cleaned.length) continue;
        out[key] = cleaned;
        count++;
        continue;
      }

      // Drop complex/nested values to reduce risk.
    }

    if (!Object.keys(out).length) return null;
    return clampTotalSize(out, MAX_TOTAL_UTF8_BYTES);
  } catch {
    return null;
  }
}

function getRequestId(request: FastifyRequest): string {
  // Request ID is per-request (NOT per user action).
  // We accept inbound x-request-id if present, otherwise generate UUID v4.
  const rawHeader = safeString(request.headers['x-request-id'], 200);

  if (rawHeader) {
    const normalized = normalizeRequestId(rawHeader);
    if (normalized) return normalized;
  }

  try {
    return randomUUID();
  } catch {
    // Fallback to Fastify's internal request.id if crypto fails.
    return String(request.id);
  }
}

function getPathWithoutQuery(url: string | undefined): string {
  if (!url) return '/';
  const idx = url.indexOf('?');
  return idx >= 0 ? url.slice(0, idx) : url;
}

type DbClient = { query: (sql: string, params?: readonly unknown[]) => Promise<unknown> };

async function tryInsertApiLog(app: { readonly db: DbClient }, row: SanitizedAuditHttpLogRecord): Promise<void> {
  try {
    await app.db.query(
      `INSERT INTO api_request_logs (
        occurred_at,
        correlation_id,
        request_id,
        http_method,
        http_path,
        query_params,
        request_headers,
        ip,
        user_agent,
        authenticated_user_id,
        authenticated_system_role,
        status_code,
        duration_ms,
        error_code
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6::jsonb, $7::jsonb,
        $8::inet, $9,
        $10::uuid, $11::user_role,
        $12, $13, $14
      )`,
      [
        row.occurredAt,
        row.correlationId,
        row.requestId,
        row.method,
        row.path,
        row.queryParams ? JSON.stringify(row.queryParams) : null,
        row.requestHeaders ? JSON.stringify(row.requestHeaders) : null,
        row.ip,
        row.userAgent,
        row.userId,
        row.systemRole,
        row.statusCode,
        row.durationMs,
        row.errorCode
      ]
    );
  } catch {
    // Best-effort: never break requests due to logging.
  }
}

export const apiDbLoggerPlugin: FastifyPluginAsync = fp(async (app) => {
  // Avoid test instability and keep unit tests fast.
  if (env.nodeEnv === 'test') return;

  app.addHook('onRequest', async (request, reply) => {
    request.auditStartMs = Date.now();
    request.auditStartHrTime = process.hrtime.bigint();
    const requestId = getRequestId(request);
    request.auditRequestId = requestId;
    try {
      // Per-request ID header (useful for infra/load balancer debugging).
      // Correlation ID is handled separately by correlationIdPlugin.
      reply.header('x-request-id', requestId);
    } catch {
      // ignore
    }
  });

  app.addHook('onError', async (request, _reply, error) => {
    const code = isAppError(error) ? error.code : 'INTERNAL_ERROR';
    request.auditErrorCode = code;
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const startHr = request.auditStartHrTime;
    const durationMs =
      typeof startHr === 'bigint'
        ? Math.max(0, Number((process.hrtime.bigint() - startHr) / 1_000_000n))
        : Math.max(0, Date.now() - (request.auditStartMs ?? Date.now()));

    const requestId = request.auditRequestId ?? String(request.id);
    const correlationId = request.correlationId;
    const method = request.method;
    const path = getPathWithoutQuery(request.raw.url);

    const forwardedIp = extractFirstIp(request.headers['x-forwarded-for']);
    const ip = (forwardedIp ?? safeString(request.ip, 128) ?? null) as string | null;
    const userAgent = safeString(request.headers['user-agent'], 500) ?? null;

    const queryParams = sanitizeQuery(request.query);
    const requestHeaders = sanitizeHeaders(request.headers);

    const authUser = request.authUser;
    const userId = authUser?.userId ?? null;
    const systemRole = authUser?.role ?? null;

    const statusCode = reply.statusCode;
    const errorCode = request.auditErrorCode ?? (reply.statusCode >= 500 ? 'INTERNAL_ERROR' : null);

    const row: SanitizedAuditHttpLogRecord = {
      occurredAt: new Date().toISOString(),
      correlationId,
      requestId,
      method,
      path,
      queryParams: (queryParams as SanitizedAuditHttpLogRecord['queryParams']) ?? null,
      requestHeaders,
      ip,
      userAgent,
      userId,
      systemRole,
      statusCode,
      durationMs,
      errorCode
    };

    setImmediate(() => {
      void tryInsertApiLog(app, row);
    });
  });
});
