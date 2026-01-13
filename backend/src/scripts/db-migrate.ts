import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDbPool, closeDbPool } from '../shared/db.js';

type MigrationRow = { name: string };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function migrationsDir(): string {
  // backend/src/scripts -> backend/sql/migrations
  return path.resolve(__dirname, '../../sql/migrations');
}

async function ensureMigrationsTable(pool: ReturnType<typeof createDbPool>): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`
  );
}

async function getAppliedMigrations(pool: ReturnType<typeof createDbPool>): Promise<Set<string>> {
  const res = await pool.query<MigrationRow>('SELECT name FROM schema_migrations');
  return new Set(res.rows.map((r) => r.name));
}

async function listMigrationFiles(dir: string): Promise<string[]> {
  const files = await readdir(dir, { withFileTypes: true });
  return files
    .filter((d) => d.isFile() && d.name.endsWith('.sql'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b));
}

async function applyMigration(pool: ReturnType<typeof createDbPool>, dir: string, name: string): Promise<void> {
  const fullPath = path.join(dir, name);
  const sql = await readFile(fullPath, 'utf8');

  await pool.query('BEGIN');
  try {
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

async function main(): Promise<void> {
  const pool = createDbPool();
  try {
    const dir = migrationsDir();
    await ensureMigrationsTable(pool);

    const applied = await getAppliedMigrations(pool);
    const files = await listMigrationFiles(dir);

    const pending = files.filter((f) => !applied.has(f));
    if (pending.length === 0) {
      console.log('db:migrate: no pending migrations');
      return;
    }

    for (const name of pending) {
      console.log(`db:migrate: applying ${name}`);
      await applyMigration(pool, dir, name);
    }

    console.log(`db:migrate: applied ${pending.length} migration(s)`);
  } finally {
    await closeDbPool(pool);
  }
}

void main();
