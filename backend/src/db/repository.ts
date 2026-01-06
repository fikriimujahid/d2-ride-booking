import type { PoolClient, QueryResultRow } from 'pg';

import { getPool } from './pool';

export type DbClient = {
  query: PoolClient['query'];
};

export async function queryRows<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: ReadonlyArray<unknown> = [],
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query<T>(text, params as unknown[]);
  return result.rows;
}

export async function withTransaction<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const value = await fn(client);
    await client.query('COMMIT');
    return value;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
