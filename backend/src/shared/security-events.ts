import { env } from '../config/env.js';
import type { Pool } from 'pg';

export type SecurityEventType =
  | 'auth.login_attempt'
  | 'auth.token_refresh'
  | 'auth.logout'
  | 'auth.mfa.totp.enroll_attempt'
  | 'auth.mfa.totp.verify_attempt'
  | 'auth.mfa.totp.enabled'
  | 'auth.permission_denied'
  | 'admin.force_action';

export type SecurityEventInsert = {
  requestId?: string;
  eventType: SecurityEventType;

  actorUserId?: string;
  actorSystemRole?: 'ADMIN' | 'DRIVER' | 'PASSENGER';
  targetUserId?: string;

  action: string;
  success: boolean;
  failureReason?: string;

  ip?: string;
  userAgent?: string;

  httpMethod?: string;
  httpPath?: string;
  httpStatusCode?: number;
  errorCode?: string;

  details?: Record<string, unknown>;
};

export async function tryInsertSecurityEvent(db: Pool, e: SecurityEventInsert): Promise<void> {
  if (env.nodeEnv === 'test') return;

  try {
    await db.query(
      `INSERT INTO security_events (
        request_id,
        event_type,
        actor_user_id,
        actor_system_role,
        target_user_id,
        action,
        success,
        failure_reason,
        ip,
        user_agent,
        http_method,
        http_path,
        http_status_code,
        error_code,
        details
      ) VALUES (
        $1,
        $2::security_event_type,
        $3::uuid,
        $4::user_role,
        $5::uuid,
        $6,
        $7,
        $8,
        $9::inet,
        $10,
        $11,
        $12,
        $13,
        $14,
        $15::jsonb
      )`,
      [
        e.requestId ?? null,
        e.eventType,
        e.actorUserId ?? null,
        e.actorSystemRole ?? null,
        e.targetUserId ?? null,
        e.action,
        e.success,
        e.failureReason ?? null,
        e.ip ?? null,
        e.userAgent ?? null,
        e.httpMethod ?? null,
        e.httpPath ?? null,
        e.httpStatusCode ?? null,
        e.errorCode ?? null,
        e.details ? JSON.stringify(e.details) : JSON.stringify({})
      ]
    );
  } catch {
    // Best-effort: never break primary flows due to audit logging.
  }
}
