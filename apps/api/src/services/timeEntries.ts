import {
  can,
  endOfWeek,
  startOfWeek,
  type Paginated,
  type TimeEntryDto,
  type TimeEntryInput,
  type TimeSummaryDto,
} from '@ledgerline/shared';
import { conflict, fieldError, forbidden, notFound } from '../errors';
import { toDbBool } from '../db/schema';
import { newId } from '../lib/ids';
import {
  paginated,
  resolvePage,
  resolveSort,
  type PageInput,
  type SortInput,
  type SortSpec,
} from '../lib/pagination';
import { sql } from 'kysely';
import { mapTimeEntry } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type WorkspaceCtx } from './context';

const TIME_SORTS: Record<string, SortSpec> = {
  date: [
    ['t.date', 'desc'],
    ['t.rowid', 'desc'],
  ],
  minutes: [['t.minutes', 'desc']],
  project: [
    ['p.name', 'asc'],
    ['t.date', 'desc'],
  ],
  user: [
    ['u.name', 'asc'],
    ['t.date', 'desc'],
  ],
  createdAt: [
    ['t.created_at', 'desc'],
    ['t.rowid', 'desc'],
  ],
};

export interface TimeEntryListQuery extends PageInput, SortInput {
  projectId?: string;
  clientId?: string;
  userId?: string;
  from?: string;
  to?: string;
  billable?: boolean;
  uninvoiced?: boolean;
  ids?: string[];
}

function baseQuery(ctx: WorkspaceCtx) {
  return ctx.db
    .selectFrom('time_entries as t')
    .innerJoin('projects as p', 'p.id', 't.project_id')
    .innerJoin('clients as c', 'c.id', 'p.client_id')
    .innerJoin('users as u', 'u.id', 't.user_id')
    .leftJoin('invoice_lines as il', 'il.id', 't.invoice_line_id')
    .where('t.workspace_id', '=', ctx.workspace.id);
}

const ENTRY_COLUMNS = [
  'p.name as project_name',
  'p.code as project_code',
  'p.client_id as client_id',
  'c.name as client_name',
  'u.name as user_name',
  'il.invoice_id as invoice_id',
  'p.hourly_rate_cents as hourly_rate_cents',
] as const;

export async function listTimeEntries(
  ctx: WorkspaceCtx,
  query: TimeEntryListQuery,
): Promise<Paginated<TimeEntryDto>> {
  const page = resolvePage(query);
  let base = baseQuery(ctx);
  if (query.projectId) base = base.where('t.project_id', '=', query.projectId);
  if (query.clientId) base = base.where('p.client_id', '=', query.clientId);
  if (query.userId) base = base.where('t.user_id', '=', query.userId);
  if (query.from) base = base.where('t.date', '>=', query.from);
  if (query.to) base = base.where('t.date', '<=', query.to);
  if (query.billable !== undefined) base = base.where('t.billable', '=', toDbBool(query.billable));
  if (query.uninvoiced) base = base.where('t.invoice_line_id', 'is', null);
  if (query.ids && query.ids.length > 0) base = base.where('t.id', 'in', query.ids);
  const sort = resolveSort(query, TIME_SORTS, 'date', ['t.id', 'asc']);
  let select = base.selectAll('t').select(ENTRY_COLUMNS);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    select.limit(page.pageSize).offset(page.offset).execute(),
  ]);
  return paginated(rows.map(mapTimeEntry), Number(total), page);
}

export async function getTimeEntry(ctx: WorkspaceCtx, id: string): Promise<TimeEntryDto> {
  const row = await baseQuery(ctx)
    .selectAll('t')
    .select(ENTRY_COLUMNS)
    .where('t.id', '=', id)
    .executeTakeFirst();
  if (!row) throw notFound('Time entry');
  return mapTimeEntry(row);
}

/** Members may only touch their own entries; accountants and above may touch anyone's. */
function assertMayEdit(ctx: WorkspaceCtx, ownerId: string): void {
  if (ownerId === ctx.user.id && can(ctx.role, 'time.manage_own')) return;
  if (can(ctx.role, 'time.manage_all')) return;
  throw forbidden('You can only edit your own time entries');
}

async function assertProject(
  ctx: WorkspaceCtx,
  projectId: string,
): Promise<{ id: string; name: string; status: string }> {
  const project = await ctx.db
    .selectFrom('projects')
    .select(['id', 'name', 'status'])
    .where('id', '=', projectId)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!project) throw fieldError('projectId', 'Project not found');
  return project;
}

async function assertMember(ctx: WorkspaceCtx, userId: string): Promise<void> {
  const member = await ctx.db
    .selectFrom('memberships')
    .select('user_id')
    .where('workspace_id', '=', ctx.workspace.id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  if (!member) throw fieldError('userId', 'That person is not a member of this workspace');
}

export async function createTimeEntry(
  ctx: WorkspaceCtx,
  input: TimeEntryInput,
): Promise<TimeEntryDto> {
  return withTransaction(ctx, async (tx) => {
    const userId = input.userId ?? tx.user.id;
    assertMayEdit(tx, userId);
    if (userId !== tx.user.id) await assertMember(tx, userId);
    const project = await assertProject(tx, input.projectId);
    const id = newId();
    const now = tx.clock.now();
    await tx.db
      .insertInto('time_entries')
      .values({
        id,
        workspace_id: tx.workspace.id,
        project_id: input.projectId,
        user_id: userId,
        date: input.date,
        minutes: input.minutes,
        description: input.description,
        billable: toDbBool(input.billable),
        invoice_line_id: null,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await logActivity(tx, {
      entityType: 'time_entry',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} logged ${formatMinutes(input.minutes)} on ${project.name}`,
      meta: { minutes: input.minutes, projectId: input.projectId, date: input.date },
    });
    return getTimeEntry(tx, id);
  });
}

export async function updateTimeEntry(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<TimeEntryInput>,
): Promise<TimeEntryDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('time_entries')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Time entry');
    assertMayEdit(tx, existing.user_id);
    if (existing.invoice_line_id)
      throw conflict('This time entry has been invoiced and can no longer be changed');
    const userId = input.userId ?? existing.user_id;
    if (userId !== existing.user_id) {
      assertMayEdit(tx, userId);
      await assertMember(tx, userId);
    }
    const projectId = input.projectId ?? existing.project_id;
    const project = await assertProject(tx, projectId);
    await tx.db
      .updateTable('time_entries')
      .set({
        project_id: projectId,
        user_id: userId,
        date: input.date ?? existing.date,
        minutes: input.minutes ?? existing.minutes,
        description: input.description ?? existing.description,
        billable: input.billable === undefined ? existing.billable : toDbBool(input.billable),
        updated_at: tx.clock.now(),
      })
      .where('id', '=', id)
      .execute();
    await logActivity(tx, {
      entityType: 'time_entry',
      entityId: id,
      action: 'updated',
      summary: `${tx.user.name} updated a time entry on ${project.name}`,
      meta: { fields: Object.keys(input) },
    });
    return getTimeEntry(tx, id);
  });
}

export async function deleteTimeEntry(ctx: WorkspaceCtx, id: string): Promise<void> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('time_entries as t')
      .innerJoin('projects as p', 'p.id', 't.project_id')
      .select(['t.id', 't.user_id', 't.minutes', 't.invoice_line_id', 'p.name as project_name'])
      .where('t.id', '=', id)
      .where('t.workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Time entry');
    assertMayEdit(tx, existing.user_id);
    if (existing.invoice_line_id)
      throw conflict('This time entry has been invoiced and cannot be deleted');
    await tx.db.deleteFrom('time_entries').where('id', '=', id).execute();
    await logActivity(tx, {
      entityType: 'time_entry',
      entityId: id,
      action: 'deleted',
      summary: `${tx.user.name} deleted ${formatMinutes(existing.minutes)} logged on ${existing.project_name}`,
      meta: { minutes: existing.minutes },
    });
  });
}

export async function timeSummary(
  ctx: WorkspaceCtx,
  range: { from?: string; to?: string },
  userId?: string,
): Promise<TimeSummaryDto> {
  const today = ctx.clock.today();
  const from = range.from ?? startOfWeek(today);
  const to = range.to ?? endOfWeek(today);
  let query = ctx.db
    .selectFrom('time_entries as t')
    .innerJoin('projects as p', 'p.id', 't.project_id')
    .innerJoin('clients as c', 'c.id', 'p.client_id')
    .select([
      't.date',
      't.minutes',
      't.billable',
      't.invoice_line_id',
      't.project_id',
      'p.name as project_name',
      'c.name as client_name',
    ])
    .where('t.workspace_id', '=', ctx.workspace.id)
    .where('t.date', '>=', from)
    .where('t.date', '<=', to);
  if (userId) query = query.where('t.user_id', '=', userId);
  const rows = await query.execute();

  let totalMinutes = 0;
  let billableMinutes = 0;
  let unbilledMinutes = 0;
  const byDay = new Map<string, { date: string; minutes: number; billableMinutes: number }>();
  const byProject = new Map<string, TimeSummaryDto['byProject'][number]>();
  for (const r of rows) {
    totalMinutes += r.minutes;
    if (r.billable) billableMinutes += r.minutes;
    if (r.billable && !r.invoice_line_id) unbilledMinutes += r.minutes;
    const day = byDay.get(r.date) ?? { date: r.date, minutes: 0, billableMinutes: 0 };
    day.minutes += r.minutes;
    if (r.billable) day.billableMinutes += r.minutes;
    byDay.set(r.date, day);
    const project = byProject.get(r.project_id) ?? {
      projectId: r.project_id,
      projectName: r.project_name,
      clientName: r.client_name,
      minutes: 0,
      billableMinutes: 0,
    };
    project.minutes += r.minutes;
    if (r.billable) project.billableMinutes += r.minutes;
    byProject.set(r.project_id, project);
  }
  return {
    from,
    to,
    totalMinutes,
    billableMinutes,
    unbilledMinutes,
    byDay: [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date)),
    byProject: [...byProject.values()].sort((a, b) => b.minutes - a.minutes),
  };
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
