import { DEFAULT_WORKSPACE_SETTINGS, type Role, type WorkspaceSettings } from '@ledgerline/shared';
import type { Clock } from '../clock';
import type { Db } from '../db';
import type { UsersTable, WorkspacesTable } from '../db/schema';
import { parseJson } from '../lib/parse';

/** Everything a service needs that is not request-specific. */
export interface Ctx {
  db: Db;
  clock: Clock;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  currency: string;
  settings: WorkspaceSettings;
  createdAt: string;
  updatedAt: string;
}

export type UserRow = Pick<UsersTable, 'id' | 'email' | 'name' | 'created_at'>;

/** A request scoped to one workspace: the acting user and their role in it. */
export interface WorkspaceCtx extends Ctx {
  workspace: WorkspaceRecord;
  user: UserRow;
  role: Role;
}

export function toWorkspaceRecord(row: WorkspacesTable): WorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    currency: row.currency,
    settings: {
      ...DEFAULT_WORKSPACE_SETTINGS,
      ...parseJson<Partial<WorkspaceSettings>>(row.settings, {}),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Run `fn` inside a transaction, reusing the ambient one when the context is already
 * transactional (SQLite has a single connection, so nested BEGINs are not allowed).
 */
export async function withTransaction<C extends Ctx, T>(
  ctx: C,
  fn: (tx: C) => Promise<T>,
): Promise<T> {
  if (ctx.db.isTransaction) return fn(ctx);
  return ctx.db.transaction().execute((trx) => fn({ ...ctx, db: trx }));
}
