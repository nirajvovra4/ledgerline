import { loadConfig } from './config';
import { createDb, migrateToLatest } from './db';
import { seedDatabase } from './seed/seed';

const USAGE = `Usage: cli <command>

Commands:
  migrate   Apply pending migrations to DATABASE_PATH
  seed      Reset every table and load the Northlight Studio demo data
`;

async function main(): Promise<void> {
  const command = process.argv[2];
  const config = loadConfig();
  if (command !== 'migrate' && command !== 'seed') {
    console.error(USAGE);
    process.exit(command ? 1 : 0);
  }
  const db = createDb(config.databasePath);
  try {
    const result = await migrateToLatest(db);
    const applied =
      result.results?.filter((r) => r.status === 'Success').map((r) => r.migrationName) ?? [];
    console.log(`Database: ${config.databasePath}`);
    console.log(
      applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Migrations up to date',
    );
    if (command === 'seed') {
      const summary = await seedDatabase(db, { log: (line) => console.log(line) });
      console.log('');
      console.log('Demo credentials (password for all: password123)');
      for (const u of summary.users) console.log(`  ${u.email.padEnd(28)} ${u.roles}`);
      console.log('');
      console.log(
        `Workspaces: ${summary.workspaces.map((w) => `${w.name} (/w/${w.slug})`).join(', ')}`,
      );
      console.log(
        `Demo "today": ${summary.today} — run the API with LEDGERLINE_TODAY=${summary.today} for a deterministic dashboard.`,
      );
    }
  } finally {
    await db.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
