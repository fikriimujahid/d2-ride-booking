import type { Pool } from 'pg';
import { sha256, randomTokenString, uuidV4 } from '../util/crypto.js';

export type RefreshTokenRow = {
  id: string;
  user_id: string;
  family_id: string;
  token_hash: Buffer;
  expires_at: Date;
  used_at: Date | null;
  revoked_at: Date | null;
};

export async function issueRefreshToken(db: Pool, opts: {
  userId: string;
  ttlDays: number;
  familyId?: string;
  ip?: string;
  ua?: string;
}) {
  const token = randomTokenString(32);
  const tokenHash = sha256(token);
  const familyId = opts.familyId ?? uuidV4();
  const expiresAt = new Date(Date.now() + opts.ttlDays * 24 * 60 * 60 * 1000);

  const inserted = await db.query<{ id: string }>(
    `insert into refresh_tokens(user_id, family_id, token_hash, expires_at, created_ip, created_ua)
     values ($1, $2, $3, $4, $5::inet, $6)
     returning id`,
    [opts.userId, familyId, tokenHash, expiresAt, opts.ip ?? null, opts.ua ?? null]
  );

  return { refreshToken: token, refreshTokenId: inserted.rows[0].id, familyId, expiresAt };
}

export async function revokeRefreshTokenByRaw(db: Pool, rawToken: string, reason: string) {
  const tokenHash = sha256(rawToken);
  await db.query(
    `update refresh_tokens
     set revoked_at = now(), revoked_reason = $2
     where token_hash = $1 and revoked_at is null`,
    [tokenHash, reason]
  );
}

export async function rotateRefreshToken(db: Pool, opts: {
  rawToken: string;
  ttlDays: number;
  ip?: string;
  ua?: string;
}) {
  const tokenHash = sha256(opts.rawToken);

  const found = await db.query<RefreshTokenRow>(
    `select id, user_id, family_id, token_hash, expires_at, used_at, revoked_at
     from refresh_tokens
     where token_hash = $1`,
    [tokenHash]
  );

  if (found.rowCount !== 1) {
    throw Object.assign(new Error('Invalid refresh token'), { statusCode: 401 });
  }

  const row = found.rows[0];

  if (row.expires_at.getTime() <= Date.now()) {
    await db.query('update refresh_tokens set revoked_at = now(), revoked_reason = $2 where id = $1 and revoked_at is null', [
      row.id,
      'expired'
    ]);
    throw Object.assign(new Error('Refresh token expired'), { statusCode: 401 });
  }

  // Reuse detection: used or revoked token presented.
  if (row.used_at || row.revoked_at) {
    await db.query(
      `update refresh_tokens
       set revoked_at = now(), revoked_reason = 'refresh_reuse_detected'
       where family_id = $1 and revoked_at is null`,
      [row.family_id]
    );
    throw Object.assign(new Error('Refresh token reuse detected'), { statusCode: 401 });
  }

  const next = await issueRefreshToken(db, {
    userId: row.user_id,
    ttlDays: opts.ttlDays,
    familyId: row.family_id,
    ip: opts.ip,
    ua: opts.ua
  });

  await db.query(
    `update refresh_tokens
     set used_at = now(), replaced_by = $2
     where id = $1`,
    [row.id, next.refreshTokenId]
  );

  return { ...next, userId: row.user_id };
}
