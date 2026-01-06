import { runMigrations } from './migrator';

async function main() {
  const result = await runMigrations();
  console.log('Migrations complete:', result);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exitCode = 1;
});
