import type { Pool } from 'pg';

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }

  interface FastifyRequest {
    /**
     * Correlation ID for a *user action / flow*.
     *
     * - Propagated via `x-correlation-id` header.
     * - Same value should be reused by the frontend across multiple concurrent requests
     *   triggered by one user action.
     * - Set by the correlationIdPlugin during onRequest.
     */
    correlationId: string;

    /**
     * Authenticated user info (set by auth plugin)
     */
    authUser?: {
      userId: string; // UUID
      role: string;   // e.g. 'admin', 'user', 'system'
    };

    /**
     * Audit / request logging metadata
     */
    auditStartMs?: number;
    auditStartHrTime?: bigint;
    auditRequestId?: string;
    auditErrorCode?: string;
  }
}