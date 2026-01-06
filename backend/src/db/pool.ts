import { Pool } from 'pg';

import { getDbConfig } from '../config/db';

let pool: Pool | undefined;

export function getPool(): Pool {
  if (pool) return pool;

  const cfg = getDbConfig();

  pool = new Pool({
    connectionString: cfg.connectionString,
    // Important: pass `false` (not `undefined`) to force-disable SSL.
    // This avoids pg attempting SSL based on connection string params or environment.
    ssl: cfg.ssl
      ? {
          rejectUnauthorized: false,
        }
      : false,
  });

  return pool;
}

export async function closePool(): Promise<void> {
  if (!pool) return;
  const current = pool;
  pool = undefined;
  await current.end();
}
