import pg from 'pg';

export function createDbPool(databaseUrl: string) {
  return new pg.Pool({
    connectionString: databaseUrl,
    max: 10
  });
}
