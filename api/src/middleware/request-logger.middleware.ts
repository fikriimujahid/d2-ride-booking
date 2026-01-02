import type { RequestHandler } from 'express';
import crypto from 'node:crypto';
import { logger } from '../config/logger.js';

function getOrCreateRequestId(req: Parameters<RequestHandler>[0]): string {
  const header = req.header('x-request-id');
  if (header && typeof header === 'string' && header.length <= 128) return header;
  return crypto.randomUUID();
}

export const requestLoggerMiddleware: RequestHandler = (req, res, next) => {
  const requestId = getOrCreateRequestId(req);
  res.setHeader('x-request-id', requestId);

  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    // Intentionally do not log req.body or Authorization header.
    logger.info('http_request', {
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Math.round(durationMs * 100) / 100,
      ip: req.ip,
      user_agent: req.header('user-agent'),
      content_type: req.header('content-type')
    });
  });

  next();
};
