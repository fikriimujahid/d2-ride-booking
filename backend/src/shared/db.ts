import { Pool, type PoolConfig } from 'pg';
import { env } from '../config/env.js';

export type DbPool = Pool;

export function createDbPool(): Pool {
  const poolConfig: PoolConfig = {
    max: env.pgPoolMax
  };

  if (env.databaseUrl) {
    poolConfig.connectionString = env.databaseUrl;
  } else {
    poolConfig.host = env.pgHost;
    poolConfig.port = env.pgPort;
    poolConfig.database = env.pgDatabase;
    poolConfig.user = env.pgUser;
    poolConfig.password = env.pgPassword;
  }

  if (env.pgSsl) {
    poolConfig.ssl = { rejectUnauthorized: false };
  }

  return new Pool(poolConfig);
}

export async function closeDbPool(pool: Pool): Promise<void> {
  await pool.end();
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Pool;
  }
}
