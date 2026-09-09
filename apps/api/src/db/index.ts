import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { Kysely, Migrator, type MigrationResultSet } from 'kysely';
import { NodeSqliteDialect } from './driver';
import { InMemoryMigrationProvider } from './migrations';
import type { Database } from './schema';

export type { Database } from './schema';

export type Db = Kysely<Database>;

/**
 * Open (or create) a SQLite database. Pass `':memory:'` for tests. File databases get WAL mode
 * and a busy timeout; every connection enforces foreign keys.
 */
export function createDb(path: string): Db {
  const isMemory = path === ':memory:';
  if (!isMemory) mkdirSync(dirname(path), { recursive: true });
  return new Kysely<Database>({
    dialect: new NodeSqliteDialect({
      path,
      onOpen(db) {
        db.exec('PRAGMA foreign_keys = ON');
        if (!isMemory) {
          db.exec('PRAGMA journal_mode = WAL');
          db.exec('PRAGMA synchronous = NORMAL');
          db.exec('PRAGMA busy_timeout = 5000');
        }
      },
    }),
  });
}

/** Apply every pending migration. Throws when any migration fails. */
export async function migrateToLatest(db: Db): Promise<MigrationResultSet> {
  const migrator = new Migrator({ db, provider: new InMemoryMigrationProvider() });
  const result = await migrator.migrateToLatest();
  if (result.error) throw result.error;
  return result;
}
