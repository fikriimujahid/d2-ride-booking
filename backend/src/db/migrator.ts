import fs from 'node:fs/promises';
import path from 'node:path';

import { getPool } from './pool';

export type MigrationResult = {
  applied: string[];
  skipped: string[];
};

const MIGRATIONS_TABLE = 'schema_migrations';

async function ensureMigrationsTable(): Promise<void> {
  const pool = getPool();
  await pool.query(
    `CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );`,
  );
}

async function getAppliedMigrationNames(): Promise<Set<string>> {
  const pool = getPool();
  const result = await pool.query<{ name: string }>(
    `SELECT name FROM ${MIGRATIONS_TABLE} ORDER BY name ASC;`,
  );
  return new Set(result.rows.map((r) => r.name));
}

async function listSqlMigrations(migrationsDir: string): Promise<string[]> {
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.sql'))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b));
}

export async function runMigrations(options?: { migrationsDir?: string }): Promise<MigrationResult> {
  const migrationsDir = options?.migrationsDir ?? path.resolve(process.cwd(), 'db', 'migrations');

  await ensureMigrationsTable();

  const applied = await getAppliedMigrationNames();
  const files = await listSqlMigrations(migrationsDir);

  const pool = getPool();

  const result: MigrationResult = { applied: [], skipped: [] };

  for (const file of files) {
    if (applied.has(file)) {
      result.skipped.push(file);
      continue;
    }

    const fullPath = path.join(migrationsDir, file);
    const sql = await fs.readFile(fullPath, 'utf8');

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query(`INSERT INTO ${MIGRATIONS_TABLE} (name) VALUES ($1);`, [file]);
      await client.query('COMMIT');
      result.applied.push(file);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  return result;
}
