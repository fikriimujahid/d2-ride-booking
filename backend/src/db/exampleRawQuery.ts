import { queryRows } from './repository';

async function main() {
  const rows = await queryRows<{ now: string }>('select now() as now;');
  console.log(rows[0]);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
