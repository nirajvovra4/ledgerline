import {
  billableAmount,
  POSTED_INVOICE_STATUSES,
  startOfWeek,
  type Paginated,
  type ProjectDto,
  type ProjectInput,
  type ProjectStats,
  type TimeEntryDto,
} from '@ledgerline/shared';
import { sql, type ExpressionBuilder } from 'kysely';
import type { Database } from '../db/schema';
import { conflict, fieldError, notFound } from '../errors';
import { newId } from '../lib/ids';
import {
  likeContains,
  paginated,
  resolvePage,
  resolveSort,
  type PageInput,
  type SortInput,
  type SortSpec,
} from '../lib/pagination';
import { mapProject } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type WorkspaceCtx } from './context';
import { listTimeEntries } from './timeEntries';

function projectAggregates(eb: ExpressionBuilder<Database, 'projects' | 'clients'>) {
  return [
    eb
      .selectFrom('time_entries as t')
      .select(sql<number>`coalesce(sum(t.minutes), 0)`.as('v'))
      .whereRef('t.project_id', '=', 'projects.id')
      .as('logged_minutes'),
    eb
      .selectFrom('time_entries as t')
      .select(sql<number>`coalesce(sum(t.minutes), 0)`.as('v'))
      .whereRef('t.project_id', '=', 'projects.id')
      .where('t.billable', '=', 1)
      .as('billable_minutes'),
    eb
      .selectFrom('time_entries as t')
      .select(sql<number>`coalesce(sum(t.minutes), 0)`.as('v'))
      .whereRef('t.project_id', '=', 'projects.id')
      .where('t.billable', '=', 1)
      .where('t.invoice_line_id', 'is', null)
      .as('unbilled_minutes'),
    eb
      .selectFrom('invoices as i')
      .select(sql<number>`coalesce(sum(i.total_cents), 0)`.as('v'))
      .whereRef('i.project_id', '=', 'projects.id')
      .where('i.status', 'in', POSTED_INVOICE_STATUSES)
      .as('invoiced_cents'),
  ];
}

const PROJECT_SORTS: Record<string, SortSpec> = {
  name: [['projects.name', 'asc']],
  code: [['projects.code', 'asc']],
  clientName: [
    ['clients.name', 'asc'],
    ['projects.name', 'asc'],
  ],
  status: [
    ['projects.status', 'asc'],
    ['projects.name', 'asc'],
  ],
  startDate: [['projects.start_date', 'desc']],
  endDate: [['projects.end_date', 'desc']],
  budget: [['projects.budget_cents', 'desc']],
  hourlyRate: [['projects.hourly_rate_cents', 'desc']],
  createdAt: [
    ['projects.created_at', 'desc'],
    ['projects.rowid', 'desc'],
  ],
};

export interface ProjectListQuery extends PageInput, SortInput {
  q?: string;
  status?: 'active' | 'on_hold' | 'completed' | 'archived' | 'all';
  clientId?: string;
}

export async function listProjects(
  ctx: WorkspaceCtx,
  query: ProjectListQuery,
): Promise<Paginated<ProjectDto>> {
  const page = resolvePage(query);
  let base = ctx.db
    .selectFrom('projects')
    .innerJoin('clients', 'clients.id', 'projects.client_id')
    .where('projects.workspace_id', '=', ctx.workspace.id);
  const status = query.status ?? 'all';
  if (status !== 'all') base = base.where('projects.status', '=', status);
  if (query.clientId) base = base.where('projects.client_id', '=', query.clientId);
  if (query.q) {
    const like = likeContains(query.q);
    base = base.where((eb) =>
      eb.or([
        eb('projects.name', 'like', like),
        eb('projects.code', 'like', like),
        eb('clients.name', 'like', like),
      ]),
    );
  }
  const sort = resolveSort(query, PROJECT_SORTS, 'name', ['projects.id', 'asc']);
  let select = base
    .selectAll('projects')
    .select('clients.name as client_name')
    .select(projectAggregates);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    select.limit(page.pageSize).offset(page.offset).execute(),
  ]);
  return paginated(rows.map(mapProject), Number(total), page);
}

export async function getProject(ctx: WorkspaceCtx, id: string): Promise<ProjectDto> {
  const row = await ctx.db
    .selectFrom('projects')
    .innerJoin('clients', 'clients.id', 'projects.client_id')
    .selectAll('projects')
    .select('clients.name as client_name')
    .select(projectAggregates)
    .where('projects.id', '=', id)
    .where('projects.workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!row) throw notFound('Project');
  return mapProject(row);
}

export async function projectStats(ctx: WorkspaceCtx, project: ProjectDto): Promise<ProjectStats> {
  const entries = await ctx.db
    .selectFrom('time_entries as t')
    .innerJoin('users as u', 'u.id', 't.user_id')
    .select(['t.user_id', 'u.name', 't.date', 't.minutes', 't.billable', 't.invoice_line_id'])
    .where('t.project_id', '=', project.id)
    .execute();
  const invoices = await ctx.db
    .selectFrom('invoices')
    .select(['total_cents', 'amount_paid_cents'])
    .where('project_id', '=', project.id)
    .where('status', 'in', POSTED_INVOICE_STATUSES)
    .execute();

  let loggedMinutes = 0;
  let billableMinutes = 0;
  let unbilledMinutes = 0;
  const byMember = new Map<string, { userId: string; name: string; minutes: number }>();
  const byWeek = new Map<string, { weekStart: string; minutes: number; billableMinutes: number }>();
  for (const e of entries) {
    loggedMinutes += e.minutes;
    if (e.billable) billableMinutes += e.minutes;
    if (e.billable && !e.invoice_line_id) unbilledMinutes += e.minutes;
    const member = byMember.get(e.user_id) ?? { userId: e.user_id, name: e.name, minutes: 0 };
    member.minutes += e.minutes;
    byMember.set(e.user_id, member);
    const weekStart = startOfWeek(e.date);
    const week = byWeek.get(weekStart) ?? { weekStart, minutes: 0, billableMinutes: 0 };
    week.minutes += e.minutes;
    if (e.billable) week.billableMinutes += e.minutes;
    byWeek.set(weekStart, week);
  }
  const invoicedCents = invoices.reduce((s, i) => s + i.total_cents, 0);
  const paidCents = invoices.reduce((s, i) => s + i.amount_paid_cents, 0);
  return {
    loggedMinutes,
    billableMinutes,
    unbilledMinutes,
    unbilledCents: billableAmount(unbilledMinutes, project.hourlyRateCents),
    invoicedCents,
    paidCents,
    budgetUsedBp:
      project.budgetCents > 0 ? Math.round((invoicedCents * 10_000) / project.budgetCents) : null,
    byMember: [...byMember.values()].sort((a, b) => b.minutes - a.minutes),
    byWeek: [...byWeek.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
  };
}

export async function getProjectDetail(
  ctx: WorkspaceCtx,
  id: string,
): Promise<{ project: ProjectDto; stats: ProjectStats; recentEntries: TimeEntryDto[] }> {
  const project = await getProject(ctx, id);
  const [stats, recent] = await Promise.all([
    projectStats(ctx, project),
    listTimeEntries(ctx, { projectId: id, pageSize: 10 }),
  ]);
  return { project, stats, recentEntries: recent.items };
}

async function assertClient(ctx: WorkspaceCtx, clientId: string): Promise<void> {
  const client = await ctx.db
    .selectFrom('clients')
    .select('id')
    .where('id', '=', clientId)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!client) throw fieldError('clientId', 'Client not found');
}

async function assertCodeFree(ctx: WorkspaceCtx, code: string, excludeId?: string): Promise<void> {
  if (!code) return;
  let q = ctx.db
    .selectFrom('projects')
    .select('id')
    .where('workspace_id', '=', ctx.workspace.id)
    .where('code', '=', code);
  if (excludeId) q = q.where('id', '!=', excludeId);
  if (await q.executeTakeFirst())
    throw conflict(`Project code ${code} is already in use`, [
      { path: 'code', message: 'Code already in use' },
    ]);
}

function toRow(input: ProjectInput) {
  return {
    client_id: input.clientId,
    name: input.name,
    code: input.code,
    description: input.description,
    status: input.status,
    billing_type: input.billingType,
    hourly_rate_cents: input.hourlyRateCents,
    budget_cents: input.budgetCents,
    start_date: input.startDate,
    end_date: input.endDate,
  };
}

export async function createProject(ctx: WorkspaceCtx, input: ProjectInput): Promise<ProjectDto> {
  return withTransaction(ctx, async (tx) => {
    await assertClient(tx, input.clientId);
    await assertCodeFree(tx, input.code);
    const id = newId();
    const now = tx.clock.now();
    await tx.db
      .insertInto('projects')
      .values({
        id,
        workspace_id: tx.workspace.id,
        ...toRow(input),
        created_at: now,
        updated_at: now,
      })
      .execute();
    const project = await getProject(tx, id);
    await logActivity(tx, {
      entityType: 'project',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} created project ${project.name} for ${project.clientName}`,
      meta: { code: project.code },
    });
    return project;
  });
}

export async function updateProject(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<ProjectInput>,
): Promise<ProjectDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('projects')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Project');
    const merged: ProjectInput = {
      clientId: input.clientId ?? existing.client_id,
      name: input.name ?? existing.name,
      code: input.code ?? existing.code,
      description: input.description ?? existing.description,
      status: input.status ?? existing.status,
      billingType: input.billingType ?? existing.billing_type,
      hourlyRateCents: input.hourlyRateCents ?? existing.hourly_rate_cents,
      budgetCents: input.budgetCents ?? existing.budget_cents,
      startDate: input.startDate === undefined ? existing.start_date : input.startDate,
      endDate: input.endDate === undefined ? existing.end_date : input.endDate,
    };
    if (merged.startDate && merged.endDate && merged.startDate > merged.endDate)
      throw fieldError('endDate', 'End date must be after the start date');
    if (merged.clientId !== existing.client_id) await assertClient(tx, merged.clientId);
    if (merged.code !== existing.code) await assertCodeFree(tx, merged.code, id);
    await tx.db
      .updateTable('projects')
      .set({ ...toRow(merged), updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    const project = await getProject(tx, id);
    const action =
      input.status && input.status !== existing.status ? `status_${input.status}` : 'updated';
    await logActivity(tx, {
      entityType: 'project',
      entityId: id,
      action,
      summary:
        action === 'updated'
          ? `${tx.user.name} updated project ${project.name}`
          : `${tx.user.name} marked project ${project.name} as ${input.status?.replace('_', ' ')}`,
      meta: { fields: Object.keys(input) },
    });
    return project;
  });
}

export async function archiveProject(ctx: WorkspaceCtx, id: string): Promise<ProjectDto> {
  return updateProject(ctx, id, { status: 'archived' });
}
