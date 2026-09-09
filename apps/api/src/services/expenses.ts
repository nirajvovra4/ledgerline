import {
  can,
  canTransitionExpense,
  formatMoney,
  isEditableExpense,
  postingsForExpense,
  postingsForExpensePayment,
  taxForLine,
  type ExpenseDetailDto,
  type ExpenseDto,
  type ExpenseInput,
  type ExpenseListSummary,
  type ExpenseStatus,
  type Paginated,
  type PayExpenseInput,
} from '@ledgerline/shared';
import { sql } from 'kysely';
import { fieldError, forbidden, invalidTransition, notFound } from '../errors';
import { toDbBool, type ExpensesTable } from '../db/schema';
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
import { mapExpense, type ExpenseRow } from '../mappers';
import { historyFor, logActivity } from './activity';
import { approvalsForSubject, decideApproval, requestApproval } from './approvals';
import { withTransaction, type WorkspaceCtx } from './context';
import { entriesForSources, postEntry } from './journal';
import { membersWithPermission, notify } from './notifications';
import { taxRateBp } from './taxRates';

const EXPENSE_SORTS: Record<string, SortSpec> = {
  date: [
    ['e.date', 'desc'],
    ['e.rowid', 'desc'],
  ],
  dueDate: [['e.due_date', 'desc']],
  vendor: [
    ['e.vendor', 'asc'],
    ['e.date', 'desc'],
  ],
  total: [['e.total_cents', 'desc']],
  status: [
    ['e.status', 'asc'],
    ['e.date', 'desc'],
  ],
  account: [
    ['a.code', 'asc'],
    ['e.date', 'desc'],
  ],
  createdAt: [
    ['e.created_at', 'desc'],
    ['e.rowid', 'desc'],
  ],
};

export interface ExpenseListQuery extends PageInput, SortInput {
  q?: string;
  status?: ExpenseStatus | 'unpaid' | 'all';
  accountId?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

function baseQuery(ctx: WorkspaceCtx) {
  return ctx.db
    .selectFrom('expenses as e')
    .innerJoin('accounts as a', 'a.id', 'e.account_id')
    .leftJoin('clients as c', 'c.id', 'e.client_id')
    .leftJoin('projects as p', 'p.id', 'e.project_id')
    .leftJoin('users as u', 'u.id', 'e.created_by')
    .where('e.workspace_id', '=', ctx.workspace.id);
}

const EXPENSE_COLUMNS = [
  'a.name as account_name',
  'c.name as client_name',
  'p.name as project_name',
  'u.name as created_by_name',
] as const;

export async function listExpenses(
  ctx: WorkspaceCtx,
  query: ExpenseListQuery,
): Promise<Paginated<ExpenseDto> & { summary: ExpenseListSummary }> {
  const page = resolvePage(query);
  let base = baseQuery(ctx);
  const status = query.status ?? 'all';
  if (status === 'unpaid') base = base.where('e.status', '=', 'approved');
  else if (status !== 'all') base = base.where('e.status', '=', status);
  if (query.accountId) base = base.where('e.account_id', '=', query.accountId);
  if (query.clientId) base = base.where('e.client_id', '=', query.clientId);
  if (query.projectId) base = base.where('e.project_id', '=', query.projectId);
  if (query.from) base = base.where('e.date', '>=', query.from);
  if (query.to) base = base.where('e.date', '<=', query.to);
  if (query.q) {
    const like = likeContains(query.q);
    base = base.where((eb) =>
      eb.or([
        eb('e.vendor', 'like', like),
        eb('e.description', 'like', like),
        eb('e.reference', 'like', like),
      ]),
    );
  }
  const sort = resolveSort(query, EXPENSE_SORTS, 'date', ['e.id', 'asc']);
  let select = base.selectAll('e').select(EXPENSE_COLUMNS);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);
  const [rows, all] = await Promise.all([
    select.limit(page.pageSize).offset(page.offset).execute(),
    base.select(['e.status', 'e.total_cents']).execute(),
  ]);
  const summary: ExpenseListSummary = {
    count: all.length,
    totalCents: 0,
    unpaidCents: 0,
    pendingCents: 0,
  };
  for (const r of all) {
    if (r.status === 'rejected') continue;
    summary.totalCents += r.total_cents;
    if (r.status === 'approved') summary.unpaidCents += r.total_cents;
    if (r.status === 'pending_approval') summary.pendingCents += r.total_cents;
  }
  return { ...paginated(rows.map(mapExpense), all.length, page), summary };
}

async function loadRow(ctx: WorkspaceCtx, id: string): Promise<ExpenseRow> {
  const row = await baseQuery(ctx)
    .selectAll('e')
    .select(EXPENSE_COLUMNS)
    .where('e.id', '=', id)
    .executeTakeFirst();
  if (!row) throw notFound('Expense');
  return row;
}

export async function getExpense(ctx: WorkspaceCtx, id: string): Promise<ExpenseDto> {
  return mapExpense(await loadRow(ctx, id));
}

export async function getExpenseDetail(ctx: WorkspaceCtx, id: string): Promise<ExpenseDetailDto> {
  const expense = await getExpense(ctx, id);
  const [approvals, journalEntries, history] = await Promise.all([
    approvalsForSubject(ctx, 'expense', id),
    entriesForSources(ctx, ctx.workspace.id, [id]),
    historyFor(ctx, ctx.workspace.id, 'expense', id),
  ]);
  return { expense, approvals, journalEntries, history };
}

interface Resolved {
  taxRateId: string | null;
  taxRateBp: number;
  taxCents: number;
  totalCents: number;
}

async function resolveReferences(ctx: WorkspaceCtx, input: ExpenseInput): Promise<Resolved> {
  const account = await ctx.db
    .selectFrom('accounts')
    .select(['id', 'type', 'archived'])
    .where('id', '=', input.accountId)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!account) throw fieldError('accountId', 'Account not found');
  if (account.type !== 'expense')
    throw fieldError('accountId', 'Expenses must post to an expense account');
  if (account.archived) throw fieldError('accountId', 'Account is archived');
  if (input.clientId) {
    const client = await ctx.db
      .selectFrom('clients')
      .select('id')
      .where('id', '=', input.clientId)
      .where('workspace_id', '=', ctx.workspace.id)
      .executeTakeFirst();
    if (!client) throw fieldError('clientId', 'Client not found');
  }
  if (input.projectId) {
    const project = await ctx.db
      .selectFrom('projects')
      .select(['id', 'client_id'])
      .where('id', '=', input.projectId)
      .where('workspace_id', '=', ctx.workspace.id)
      .executeTakeFirst();
    if (!project) throw fieldError('projectId', 'Project not found');
    if (input.clientId && project.client_id !== input.clientId)
      throw fieldError('projectId', 'Project belongs to a different client');
  }
  const rate = await taxRateBp(ctx, ctx.workspace.id, input.taxRateId);
  if (input.taxRateId && !rate) throw fieldError('taxRateId', 'Tax rate not found');
  const bp = rate?.rateBp ?? 0;
  const taxCents = taxForLine(input.amountCents, bp);
  return {
    taxRateId: rate?.id ?? null,
    taxRateBp: bp,
    taxCents,
    totalCents: input.amountCents + taxCents,
  };
}

function money(ctx: WorkspaceCtx, cents: number): string {
  return formatMoney(cents, ctx.workspace.currency);
}

function link(ctx: WorkspaceCtx, id: string): string {
  return `/w/${ctx.workspace.slug}/expenses/${id}`;
}

export async function createExpense(
  ctx: WorkspaceCtx,
  input: ExpenseInput,
): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const resolved = await resolveReferences(tx, input);
    const id = newId();
    const now = tx.clock.now();
    await tx.db
      .insertInto('expenses')
      .values({
        id,
        workspace_id: tx.workspace.id,
        vendor: input.vendor,
        description: input.description,
        date: input.date,
        due_date: input.dueDate,
        account_id: input.accountId,
        amount_cents: input.amountCents,
        tax_rate_id: resolved.taxRateId,
        tax_rate_bp: resolved.taxRateBp,
        tax_cents: resolved.taxCents,
        total_cents: resolved.totalCents,
        status: 'draft',
        client_id: input.clientId,
        project_id: input.projectId,
        billable: toDbBool(input.billable),
        paid_at: null,
        payment_method: null,
        reference: input.reference,
        notes: input.notes,
        created_by: tx.user.id,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} added an expense from ${input.vendor} (${money(tx, resolved.totalCents)})`,
      meta: { vendor: input.vendor, totalCents: resolved.totalCents },
    });
    return getExpenseDetail(tx, id);
  });
}

function assertMayEdit(
  ctx: WorkspaceCtx,
  expense: Pick<ExpensesTable, 'status' | 'created_by' | 'vendor'>,
): void {
  if (!isEditableExpense(expense.status))
    throw invalidTransition(
      `This expense is ${expense.status.replace('_', ' ')} and can no longer be edited`,
    );
  if (expense.created_by !== ctx.user.id && !can(ctx.role, 'expenses.approve'))
    throw forbidden('You can only edit your own expenses');
}

export async function updateExpense(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<ExpenseInput>,
): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Expense');
    assertMayEdit(tx, existing);
    const merged: ExpenseInput = {
      vendor: input.vendor ?? existing.vendor,
      description: input.description ?? existing.description,
      date: input.date ?? existing.date,
      dueDate: input.dueDate === undefined ? existing.due_date : input.dueDate,
      accountId: input.accountId ?? existing.account_id,
      amountCents: input.amountCents ?? existing.amount_cents,
      taxRateId: input.taxRateId === undefined ? existing.tax_rate_id : input.taxRateId,
      clientId: input.clientId === undefined ? existing.client_id : input.clientId,
      projectId: input.projectId === undefined ? existing.project_id : input.projectId,
      billable: input.billable ?? Boolean(existing.billable),
      reference: input.reference ?? existing.reference,
      notes: input.notes ?? existing.notes,
    };
    if (merged.billable && !merged.clientId)
      throw fieldError('clientId', 'Billable expenses need a client');
    const resolved = await resolveReferences(tx, merged);
    await tx.db
      .updateTable('expenses')
      .set({
        vendor: merged.vendor,
        description: merged.description,
        date: merged.date,
        due_date: merged.dueDate,
        account_id: merged.accountId,
        amount_cents: merged.amountCents,
        tax_rate_id: resolved.taxRateId,
        tax_rate_bp: resolved.taxRateBp,
        tax_cents: resolved.taxCents,
        total_cents: resolved.totalCents,
        client_id: merged.clientId,
        project_id: merged.projectId,
        billable: toDbBool(merged.billable),
        reference: merged.reference,
        notes: merged.notes,
        updated_at: tx.clock.now(),
      })
      .where('id', '=', id)
      .execute();
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'updated',
      summary: `${tx.user.name} edited the expense from ${merged.vendor} (${money(tx, resolved.totalCents)})`,
      meta: { fields: Object.keys(input) },
    });
    return getExpenseDetail(tx, id);
  });
}

export async function deleteExpense(ctx: WorkspaceCtx, id: string): Promise<void> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('expenses')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Expense');
    if (existing.status !== 'draft')
      throw invalidTransition(
        `This expense is ${existing.status.replace('_', ' ')}; only drafts can be deleted`,
      );
    if (existing.created_by !== tx.user.id && !can(tx.role, 'expenses.approve'))
      throw forbidden('You can only delete your own expenses');
    await tx.db
      .deleteFrom('approvals')
      .where('subject_type', '=', 'expense')
      .where('subject_id', '=', id)
      .execute();
    await tx.db.deleteFrom('expenses').where('id', '=', id).execute();
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'deleted',
      summary: `${tx.user.name} deleted a draft expense from ${existing.vendor}`,
      meta: { vendor: existing.vendor },
    });
  });
}

export async function submitExpense(ctx: WorkspaceCtx, id: string): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const exp = await loadRow(tx, id);
    if (!canTransitionExpense(exp.status, 'pending_approval'))
      throw invalidTransition(
        `This expense cannot be submitted from ${exp.status.replace('_', ' ')}`,
      );
    if (exp.created_by !== tx.user.id && !can(tx.role, 'expenses.approve'))
      throw forbidden('You can only submit your own expenses');
    await tx.db
      .updateTable('expenses')
      .set({ status: 'pending_approval', updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    await requestApproval(tx, 'expense', id);
    const approvers = await membersWithPermission(
      tx,
      tx.workspace.id,
      'expenses.approve',
      tx.user.id,
    );
    await notify(tx, {
      userIds: approvers,
      kind: 'approval_requested',
      title: `Expense from ${exp.vendor} needs approval`,
      body: `${tx.user.name} submitted "${exp.description}" (${money(tx, exp.total_cents)}).`,
      link: link(tx, id),
    });
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'submitted',
      summary: `${tx.user.name} submitted the ${exp.vendor} expense for approval`,
      meta: { totalCents: exp.total_cents },
    });
    return getExpenseDetail(tx, id);
  });
}

export async function approveExpense(
  ctx: WorkspaceCtx,
  id: string,
  comment = '',
): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const exp = await loadRow(tx, id);
    if (!canTransitionExpense(exp.status, 'approved'))
      throw invalidTransition(
        `This expense cannot be approved from ${exp.status.replace('_', ' ')}`,
      );
    const entry = await postEntry(tx, {
      date: exp.date,
      memo: `Expense — ${exp.vendor}: ${exp.description}`,
      sourceType: 'expense',
      sourceId: id,
      lines: postingsForExpense({
        vendor: exp.vendor,
        description: exp.description,
        accountId: exp.account_id,
        amountCents: exp.amount_cents,
        taxCents: exp.tax_cents,
        totalCents: exp.total_cents,
      }),
    });
    await tx.db
      .updateTable('expenses')
      .set({ status: 'approved', updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    const { requestedBy } = await decideApproval(tx, 'expense', id, 'approved', comment);
    if (requestedBy) {
      await notify(tx, {
        userIds: [requestedBy],
        kind: 'approval_decided',
        title: `Expense from ${exp.vendor} approved`,
        body: `${tx.user.name} approved "${exp.description}" (${money(tx, exp.total_cents)}).${comment ? ` "${comment}"` : ''}`,
        link: link(tx, id),
      });
    }
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'approved',
      summary: `${tx.user.name} approved the ${exp.vendor} expense (${money(tx, exp.total_cents)})`,
      meta: { journalEntryId: entry.id, comment },
    });
    return getExpenseDetail(tx, id);
  });
}

export async function rejectExpense(
  ctx: WorkspaceCtx,
  id: string,
  comment: string,
): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const exp = await loadRow(tx, id);
    if (!canTransitionExpense(exp.status, 'rejected'))
      throw invalidTransition('Only expenses awaiting approval can be rejected');
    await tx.db
      .updateTable('expenses')
      .set({ status: 'rejected', updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    const { requestedBy } = await decideApproval(tx, 'expense', id, 'rejected', comment);
    if (requestedBy) {
      await notify(tx, {
        userIds: [requestedBy],
        kind: 'approval_decided',
        title: `Expense from ${exp.vendor} rejected`,
        body: `${tx.user.name} rejected "${exp.description}": "${comment}"`,
        link: link(tx, id),
      });
    }
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'rejected',
      summary: `${tx.user.name} rejected the ${exp.vendor} expense: ${comment}`,
      meta: { comment },
    });
    return getExpenseDetail(tx, id);
  });
}

export async function payExpense(
  ctx: WorkspaceCtx,
  id: string,
  input: PayExpenseInput,
): Promise<ExpenseDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const exp = await loadRow(tx, id);
    if (!canTransitionExpense(exp.status, 'paid'))
      throw invalidTransition(`This expense cannot be paid from ${exp.status.replace('_', ' ')}`);
    const entry = await postEntry(tx, {
      date: input.date,
      memo: `Paid ${exp.vendor} — ${exp.description}`,
      sourceType: 'expense_payment',
      sourceId: id,
      lines: postingsForExpensePayment({
        vendor: exp.vendor,
        totalCents: exp.total_cents,
        reference: input.reference || undefined,
      }),
    });
    await tx.db
      .updateTable('expenses')
      .set({
        status: 'paid',
        paid_at: input.date,
        payment_method: input.method,
        reference: input.reference || exp.reference,
        updated_at: tx.clock.now(),
      })
      .where('id', '=', id)
      .execute();
    await logActivity(tx, {
      entityType: 'expense',
      entityId: id,
      action: 'paid',
      summary: `${tx.user.name} paid ${exp.vendor} ${money(tx, exp.total_cents)} by ${input.method.replace('_', ' ')}`,
      meta: { journalEntryId: entry.id, method: input.method, date: input.date },
    });
    return getExpenseDetail(tx, id);
  });
}
