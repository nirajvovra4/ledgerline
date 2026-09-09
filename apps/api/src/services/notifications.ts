import {
  can,
  type NotificationDto,
  type NotificationKind,
  type Paginated,
  type Permission,
  type Role,
} from '@ledgerline/shared';
import { sql } from 'kysely';
import { notFound } from '../errors';
import { newId } from '../lib/ids';
import { paginated, resolvePage, type PageInput } from '../lib/pagination';
import { mapNotification } from '../mappers';
import type { Ctx, WorkspaceCtx } from './context';

export interface NotifyInput {
  userIds: Iterable<string>;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
}

/** Create one notification per recipient (deduplicated). */
export async function notify(ctx: WorkspaceCtx, input: NotifyInput): Promise<number> {
  const recipients = [...new Set(input.userIds)];
  if (recipients.length === 0) return 0;
  const now = ctx.clock.now();
  await ctx.db
    .insertInto('notifications')
    .values(
      recipients.map((userId) => ({
        id: newId(),
        workspace_id: ctx.workspace.id,
        user_id: userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        link: input.link,
        read_at: null,
        created_at: now,
      })),
    )
    .execute();
  return recipients.length;
}

/** Members of the workspace who hold `permission`, optionally excluding one user. */
export async function membersWithPermission(
  ctx: Ctx,
  workspaceId: string,
  permission: Permission,
  exclude?: string,
): Promise<string[]> {
  const rows = await ctx.db
    .selectFrom('memberships')
    .select(['user_id', 'role'])
    .where('workspace_id', '=', workspaceId)
    .execute();
  return rows
    .filter((r) => can(r.role as Role, permission) && r.user_id !== exclude)
    .map((r) => r.user_id);
}

export interface NotificationListQuery extends PageInput {
  unread?: boolean;
}

export async function listNotifications(
  ctx: WorkspaceCtx,
  query: NotificationListQuery,
): Promise<Paginated<NotificationDto> & { unreadCount: number }> {
  const page = resolvePage(query);
  let base = ctx.db
    .selectFrom('notifications')
    .where('workspace_id', '=', ctx.workspace.id)
    .where('user_id', '=', ctx.user.id);
  if (query.unread) base = base.where('read_at', 'is', null);

  const [{ total }, { unread }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    ctx.db
      .selectFrom('notifications')
      .where('workspace_id', '=', ctx.workspace.id)
      .where('user_id', '=', ctx.user.id)
      .where('read_at', 'is', null)
      .select((eb) => eb.fn.countAll<number>().as('unread'))
      .executeTakeFirstOrThrow(),
    base
      .selectAll()
      .orderBy('created_at', 'desc')
      .orderBy(sql`rowid`, 'desc')
      .limit(page.pageSize)
      .offset(page.offset)
      .execute(),
  ]);
  return {
    ...paginated(rows.map(mapNotification), Number(total), page),
    unreadCount: Number(unread),
  };
}

export async function markRead(ctx: WorkspaceCtx, id: string): Promise<NotificationDto> {
  const row = await ctx.db
    .selectFrom('notifications')
    .selectAll()
    .where('id', '=', id)
    .where('workspace_id', '=', ctx.workspace.id)
    .where('user_id', '=', ctx.user.id)
    .executeTakeFirst();
  if (!row) throw notFound('Notification');
  if (!row.read_at) {
    row.read_at = ctx.clock.now();
    await ctx.db
      .updateTable('notifications')
      .set({ read_at: row.read_at })
      .where('id', '=', id)
      .execute();
  }
  return mapNotification(row);
}

export async function markAllRead(ctx: WorkspaceCtx): Promise<number> {
  const result = await ctx.db
    .updateTable('notifications')
    .set({ read_at: ctx.clock.now() })
    .where('workspace_id', '=', ctx.workspace.id)
    .where('user_id', '=', ctx.user.id)
    .where('read_at', 'is', null)
    .executeTakeFirst();
  return Number(result.numUpdatedRows ?? 0);
}
