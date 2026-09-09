import { createClock } from './clock';
import { loadConfig } from './config';
import { createDb, migrateToLatest } from './db';
import { buildApp } from './app';
import { seedDatabase } from './seed/seed';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createDb(config.databasePath);
  await migrateToLatest(db);
  const clock = createClock(config.today);

  if (config.seedIfEmpty) {
    const { c } = await db
      .selectFrom('users')
      .select((eb) => eb.fn.countAll<number>().as('c'))
      .executeTakeFirstOrThrow();
    if (Number(c) === 0) {
      console.log('SEED_IF_EMPTY=true and no users found — loading the demo workspace…');
      await seedDatabase(db, { log: (line) => console.log(line) });
    }
  }

  const app = await buildApp({
    db,
    clock,
    staticDir: config.staticDir,
    secureCookies: config.nodeEnv === 'production',
    logger: { level: config.nodeEnv === 'production' ? 'info' : 'info' },
  });

  const shutdown = async (signal: string): Promise<void> => {
    app.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      await db.destroy();
      process.exit(0);
    } catch (err) {
      app.log.error(err);
      process.exit(1);
    }
  };
  process.once('SIGINT', () => void shutdown('SIGINT'));
  process.once('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.port, host: config.host });
  app.log.info(
    {
      database: config.databasePath,
      today: clock.today(),
      fixedClock: clock.fixed,
      staticDir: config.staticDir ?? '(none)',
    },
    'Ledgerline API ready',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
