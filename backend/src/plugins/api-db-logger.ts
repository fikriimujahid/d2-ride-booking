import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { env } from '../config/env.js';
import { isAppError } from '../shared/errors.js';

declare module 'fastify' {
  interface FastifyRequest {
    auditStartMs?: number;
    auditRequestId?: string;
    auditErrorCode?: string;
  }
}

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

function safeString(value: unknown, maxLen = 500): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return trimmed.length > maxLen ? trimmed.slice(0, maxLen) : trimmed;
}

function sanitizeHeaders(headers: FastifyRequest['headers']): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const [rawKey, rawValue] of Object.entries(headers)) {
    const key = rawKey.toLowerCase();
    if (!HEADER_ALLOWLIST.has(key)) continue;
    if (key === 'authorization' || key === 'cookie' || key === 'set-cookie') continue;

    const value = Array.isArray(rawValue) ? rawValue.join(',') : rawValue;
    const str = safeString(value);
    if (str) out[key] = str;
  }
  return Object.keys(out).length ? out : null;
}

function sanitizeQuery(query: unknown): Record<string, unknown> | null {
  if (!query || typeof query !== 'object') return null;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key) || PII_KEY.test(key)) continue;

    if (typeof value === 'string') {
      const v = safeString(value, 200);
      if (v) out[key] = v;
      continue;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value;
      continue;
    }

    if (Array.isArray(value)) {
      const cleaned = value
        .map((x) => (typeof x === 'string' ? safeString(x, 200) : undefined))
        .filter((x): x is string => typeof x === 'string');
      if (cleaned.length) out[key] = cleaned.slice(0, 20);
      continue;
    }

    // Drop complex/nested values to reduce PII risk.
  }

  return Object.keys(out).length ? out : null;
}

function getCorrelationId(request: FastifyRequest): string {
  const fromHeader =
    safeString(request.headers['x-request-id']) ||
    safeString(request.headers['x-correlation-id']);
  if (fromHeader) return fromHeader;
  return String(request.id);
}

function getPathWithoutQuery(url: string | undefined): string {
  if (!url) return '/';
  const idx = url.indexOf('?');
  return idx >= 0 ? url.slice(0, idx) : url;
}

async function tryInsertApiLog(app: { db: { query: (sql: string, params?: unknown[]) => Promise<unknown> } }, row: {
  occurredAt: string;
  requestId: string;
  method: string;
  path: string;
  queryParams: Record<string, unknown> | null;
  requestHeaders: Record<string, string> | null;
  ip: string | undefined;
  userAgent: string | undefined;
  userId: string | null;
  systemRole: string | null;
  statusCode: number;
  durationMs: number;
  errorCode: string | null;
}): Promise<void> {
  try {
    await app.db.query(
      `INSERT INTO api_request_logs (
        occurred_at,
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
        $1, $2, $3, $4,
        $5::jsonb, $6::jsonb,
        $7::inet, $8,
        $9::uuid, $10::user_role,
        $11, $12, $13
      )`,
      [
        row.occurredAt,
        row.requestId,
        row.method,
        row.path,
        row.queryParams ? JSON.stringify(row.queryParams) : null,
        row.requestHeaders ? JSON.stringify(row.requestHeaders) : null,
        row.ip ?? null,
        row.userAgent ?? null,
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

  app.addHook('onRequest', async (request) => {
    request.auditStartMs = Date.now();
    request.auditRequestId = getCorrelationId(request);
  });

  app.addHook('onError', async (request, _reply, error) => {
    const code = isAppError(error) ? error.code : 'INTERNAL_ERROR';
    request.auditErrorCode = code;
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const start = request.auditStartMs ?? Date.now();
    const durationMs = Math.max(0, Date.now() - start);

    const requestId = request.auditRequestId ?? String(request.id);
    const method = request.method;
    const path = getPathWithoutQuery(request.raw.url);

    const ip = request.ip;
    const userAgent = safeString(request.headers['user-agent'], 500);

    const queryParams = sanitizeQuery(request.query);
    const requestHeaders = sanitizeHeaders(request.headers);

    const authUser = request.authUser;
    const userId = authUser?.userId ?? null;
    const systemRole = authUser?.role ?? null;

    const statusCode = reply.statusCode;
    const errorCode = request.auditErrorCode ?? null;

    await tryInsertApiLog(app, {
      occurredAt: new Date().toISOString(),
      requestId,
      method,
      path,
      queryParams,
      requestHeaders,
      ip,
      userAgent,
      userId,
      systemRole,
      statusCode,
      durationMs,
      errorCode
    });
  });
});
