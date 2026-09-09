import type { ActivityDto, ActivityEntityType } from '@ledgerline/shared';
import { sql } from 'kysely';
import { newId } from '../lib/ids';
import { mapActivity } from '../mappers';
import type { Ctx, WorkspaceCtx } from './context';

export interface ActivityInput {
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  /** Human sentence, e.g. "Ada approved INV-1042 for Acme". */
  summary: string;
  meta?: Record<string, unknown>;
}

/** Append one row to the workspace activity log. Called by every mutating service. */
export async function logActivity(ctx: WorkspaceCtx, input: ActivityInput): Promise<string> {
  const id = newId();
  await ctx.db
    .insertInto('activity_log')
    .values({
      id,
      workspace_id: ctx.workspace.id,
      actor_id: ctx.user.id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      action: input.action,
      summary: input.summary,
      meta: JSON.stringify(input.meta ?? {}),
      created_at: ctx.clock.now(),
    })
    .execute();
  return id;
}

export interface ActivityListOptions {
  limit?: number;
  /** Return only rows created strictly before this ISO timestamp (cursor pagination). */
  before?: string;
  entityType?: ActivityEntityType;
  entityId?: string;
}

export async function listActivity(
  ctx: Ctx,
  workspaceId: string,
  options: ActivityListOptions = {},
): Promise<ActivityDto[]> {
  const limit = Math.min(200, Math.max(1, options.limit ?? 50));
  let query = ctx.db
    .selectFrom('activity_log as a')
    .leftJoin('users as u', 'u.id', 'a.actor_id')
    .selectAll('a')
    .select('u.name as actor_name')
    .where('a.workspace_id', '=', workspaceId)
    .orderBy('a.created_at', 'desc')
    .orderBy(sql`a.rowid`, 'desc')
    .limit(limit);
  if (options.before) query = query.where('a.created_at', '<', options.before);
  if (options.entityType) query = query.where('a.entity_type', '=', options.entityType);
  if (options.entityId) query = query.where('a.entity_id', '=', options.entityId);
  const rows = await query.execute();
  return rows.map(mapActivity);
}

/** History of a single record, oldest first (used on invoice and expense detail screens). */
export async function historyFor(
  ctx: Ctx,
  workspaceId: string,
  entityType: ActivityEntityType,
  entityId: string,
): Promise<ActivityDto[]> {
  const rows = await listActivity(ctx, workspaceId, { entityType, entityId, limit: 200 });
  return rows.reverse();
}
