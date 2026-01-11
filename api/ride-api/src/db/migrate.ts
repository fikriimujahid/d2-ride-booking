import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Use a service-specific migrations table to avoid filename collisions
  // when multiple APIs share the same physical database.
  const migrationsTable = 'schema_migrations_ride_api';

  const pool = createDbPool(databaseUrl);

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const migrationFiles = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(
      `create table if not exists ${migrationsTable} (id bigserial primary key, filename text not null unique, applied_at timestamptz not null default now())`
    );
    await client.query('commit');

    const applied = await client.query<{ filename: string }>(`select filename from ${migrationsTable}`);
    const appliedSet = new Set(applied.rows.map((r) => r.filename));

    for (const filename of migrationFiles) {
      if (appliedSet.has(filename)) continue;

      const fullPath = path.join(migrationsDir, filename);
      const sql = await readFile(fullPath, 'utf8');

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query(`insert into ${migrationsTable}(filename) values ($1)`, [filename]);
        await client.query('commit');
        console.log(`applied ${filename}`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      }
    }
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
