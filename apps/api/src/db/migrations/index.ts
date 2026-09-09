import type { Migration, MigrationProvider } from 'kysely';
import { migration001 } from './001_initial';

/**
 * Migrations are registered in code (rather than discovered on disk) so that esbuild can bundle
 * them into `dist/server.js`. Keys sort lexicographically, which is the order Kysely applies them.
 */
export const migrations: Record<string, Migration> = {
  '001_initial': migration001,
};

export class InMemoryMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}
