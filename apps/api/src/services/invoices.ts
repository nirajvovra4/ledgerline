import {
  addDays,
  billableAmount,
  canTransition,
  computeInvoiceTotals,
  formatInvoiceNumber,
  formatMoney,
  isPostedInvoice,
  OPEN_INVOICE_STATUSES,
  can,
  postingsForInvoice,
  type InvoiceDetailDto,
  type InvoiceDto,
  type InvoiceFromTimeInput,
  type InvoiceInput,
  type InvoiceLineInput,
  type InvoiceListSummary,
  type InvoiceStatus,
  type Paginated,
  type PaymentDto,
} from '@ledgerline/shared';
import { sql } from 'kysely';
import { conflict, fieldError, forbidden, invalidTransition, notFound } from '../errors';
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
import { mapInvoice, mapInvoiceLine, mapPayment, type InvoiceRow } from '../mappers';
import type { InvoicesTable } from '../db/schema';
import { historyFor, logActivity } from './activity';
import { approvalsForSubject, decideApproval, requestApproval } from './approvals';
import { getClient } from './clients';
import { withTransaction, type WorkspaceCtx } from './context';
import {
  entriesForSources,
  findEntryForSource,
  postEntry,
  reverseEntry,
  systemAccountId,
} from './journal';
import { membersWithPermission, notify } from './notifications';
import { getProject } from './projects';
import { taxRateBp } from './taxRates';
import { loadWorkspace, saveSettings } from './workspaces';

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

const INVOICE_SORTS: Record<string, SortSpec> = {
  issueDate: [
    ['i.issue_date', 'desc'],
    ['i.number', 'desc'],
  ],
  dueDate: [
    ['i.due_date', 'desc'],
    ['i.number', 'desc'],
  ],
  number: [['i.number', 'desc']],
  clientName: [
    ['c.name', 'asc'],
    ['i.issue_date', 'desc'],
  ],
  status: [
    ['i.status', 'asc'],
    ['i.issue_date', 'desc'],
  ],
  total: [['i.total_cents', 'desc']],
  balance: [['balance_cents', 'desc']],
  createdAt: [
    ['i.created_at', 'desc'],
    ['i.rowid', 'desc'],
  ],
};

export interface InvoiceListQuery extends PageInput, SortInput {
  q?: string;
  status?: InvoiceStatus | 'overdue' | 'open' | 'all';
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
}

function baseQuery(ctx: WorkspaceCtx) {
  return ctx.db
    .selectFrom('invoices as i')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .leftJoin('projects as p', 'p.id', 'i.project_id')
    .where('i.workspace_id', '=', ctx.workspace.id);
}

export async function listInvoices(
  ctx: WorkspaceCtx,
  query: InvoiceListQuery,
): Promise<Paginated<InvoiceDto> & { summary: InvoiceListSummary }> {
  const today = ctx.clock.today();
  const page = resolvePage(query);
  let base = baseQuery(ctx);
  const status = query.status ?? 'all';
  if (status === 'overdue')
    base = base.where('i.status', 'in', ['sent', 'partially_paid']).where('i.due_date', '<', today);
  else if (status === 'open') base = base.where('i.status', 'in', OPEN_INVOICE_STATUSES);
  else if (status !== 'all') base = base.where('i.status', '=', status);
  if (query.clientId) base = base.where('i.client_id', '=', query.clientId);
  if (query.projectId) base = base.where('i.project_id', '=', query.projectId);
  if (query.from) base = base.where('i.issue_date', '>=', query.from);
  if (query.to) base = base.where('i.issue_date', '<=', query.to);
  if (query.q) {
    const like = likeContains(query.q);
    base = base.where((eb) =>
      eb.or([
        eb('i.number', 'like', like),
        eb('c.name', 'like', like),
        eb('i.po_number', 'like', like),
      ]),
    );
  }
  const sort = resolveSort(query, INVOICE_SORTS, 'issueDate', ['i.id', 'asc']);
  let select = base
    .selectAll('i')
    .select([
      'c.name as client_name',
      'p.name as project_name',
      sql<number>`i.total_cents - i.amount_paid_cents`.as('balance_cents'),
    ]);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);

  const [rows, all] = await Promise.all([
    select.limit(page.pageSize).offset(page.offset).execute(),
    base.select(['i.status', 'i.due_date', 'i.total_cents', 'i.amount_paid_cents']).execute(),
  ]);
  const summary: InvoiceListSummary = {
    count: all.length,
    totalCents: 0,
    outstandingCents: 0,
    overdueCents: 0,
  };
  for (const r of all) {
    if (r.status === 'void') continue;
    summary.totalCents += r.total_cents;
    if (OPEN_INVOICE_STATUSES.includes(r.status)) {
      const balance = Math.max(0, r.total_cents - r.amount_paid_cents);
      summary.outstandingCents += balance;
      if (r.status !== 'approved' && r.due_date < today) summary.overdueCents += balance;
    }
  }
  return {
    ...paginated(
      rows.map((r) => mapInvoice(r, today)),
      all.length,
      page,
    ),
    summary,
  };
}

async function loadRow(ctx: WorkspaceCtx, id: string): Promise<InvoiceRow> {
  const row = await baseQuery(ctx)
    .selectAll('i')
    .select(['c.name as client_name', 'p.name as project_name'])
    .where('i.id', '=', id)
    .executeTakeFirst();
  if (!row) throw notFound('Invoice');
  return row;
}

export async function getInvoice(ctx: WorkspaceCtx, id: string): Promise<InvoiceDto> {
  return mapInvoice(await loadRow(ctx, id), ctx.clock.today());
}

export async function paymentsForInvoice(
  ctx: WorkspaceCtx,
  invoiceId: string,
): Promise<PaymentDto[]> {
  const rows = await ctx.db
    .selectFrom('payments as pm')
    .innerJoin('invoices as i', 'i.id', 'pm.invoice_id')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .selectAll('pm')
    .select(['i.number as invoice_number', 'i.client_id as client_id', 'c.name as client_name'])
    .where('pm.invoice_id', '=', invoiceId)
    .orderBy('pm.date')
    .orderBy(sql`pm.rowid`)
    .execute();
  return rows.map(mapPayment);
}

export async function getInvoiceDetail(ctx: WorkspaceCtx, id: string): Promise<InvoiceDetailDto> {
  const row = await loadRow(ctx, id);
  const invoice = mapInvoice(row, ctx.clock.today());
  const [lines, client, project, payments, approvals, history] = await Promise.all([
    ctx.db
      .selectFrom('invoice_lines')
      .selectAll()
      .where('invoice_id', '=', id)
      .orderBy('position')
      .execute(),
    getClient(ctx, row.client_id),
    row.project_id ? getProject(ctx, row.project_id).catch(() => null) : Promise.resolve(null),
    paymentsForInvoice(ctx, id),
    approvalsForSubject(ctx, 'invoice', id),
    historyFor(ctx, ctx.workspace.id, 'invoice', id),
  ]);
  const journalEntries = await entriesForSources(ctx, ctx.workspace.id, [
    id,
    ...payments.map((p) => p.id),
  ]);
  return {
    ...invoice,
    lines: lines.map(mapInvoiceLine),
    client,
    project,
    payments,
    approvals,
    journalEntries,
    history,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

interface ResolvedLine {
  id: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  taxRateId: string | null;
  taxRateBp: number;
  accountId: string;
}

/** Validate line references (tax rates, revenue accounts) against the workspace. */
async function resolveLines(ctx: WorkspaceCtx, lines: InvoiceLineInput[]): Promise<ResolvedLine[]> {
  const accountIds = [...new Set(lines.map((l) => l.accountId))];
  const accounts = await ctx.db
    .selectFrom('accounts')
    .select(['id', 'type', 'archived'])
    .where('workspace_id', '=', ctx.workspace.id)
    .where('id', 'in', accountIds)
    .execute();
  const accountById = new Map(accounts.map((a) => [a.id, a] as const));
  const out: ResolvedLine[] = [];
  for (const [i, line] of lines.entries()) {
    const account = accountById.get(line.accountId);
    if (!account) throw fieldError(`lines.${i}.accountId`, 'Account not found');
    if (account.type !== 'revenue')
      throw fieldError(`lines.${i}.accountId`, 'Invoice lines must post to a revenue account');
    if (account.archived) throw fieldError(`lines.${i}.accountId`, 'Account is archived');
    const rate = await taxRateBp(ctx, ctx.workspace.id, line.taxRateId);
    if (line.taxRateId && !rate) throw fieldError(`lines.${i}.taxRateId`, 'Tax rate not found');
    out.push({
      id: line.id ?? newId(),
      description: line.description,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
      taxRateId: rate?.id ?? null,
      taxRateBp: rate?.rateBp ?? 0,
      accountId: line.accountId,
    });
  }
  return out;
}

async function assertClientAndProject(
  ctx: WorkspaceCtx,
  clientId: string,
  projectId: string | null,
): Promise<{ clientName: string; paymentTermsDays: number }> {
  const client = await ctx.db
    .selectFrom('clients')
    .select(['id', 'name', 'payment_terms_days'])
    .where('id', '=', clientId)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!client) throw fieldError('clientId', 'Client not found');
  if (projectId) {
    const project = await ctx.db
      .selectFrom('projects')
      .select(['id', 'client_id'])
      .where('id', '=', projectId)
      .where('workspace_id', '=', ctx.workspace.id)
      .executeTakeFirst();
    if (!project) throw fieldError('projectId', 'Project not found');
    if (project.client_id !== clientId)
      throw fieldError('projectId', 'Project belongs to a different client');
  }
  return { clientName: client.name, paymentTermsDays: client.payment_terms_days };
}

/** Take the next invoice number from workspace settings, inside the caller's transaction. */
async function allocateNumber(ctx: WorkspaceCtx): Promise<string> {
  const ws = await loadWorkspace(ctx, ctx.workspace.id);
  const { invoicePrefix, nextInvoiceNumber, invoiceNumberPadding } = ws.settings;
  const number = formatInvoiceNumber(invoicePrefix, nextInvoiceNumber, invoiceNumberPadding);
  const clash = await ctx.db
    .selectFrom('invoices')
    .select('id')
    .where('workspace_id', '=', ws.id)
    .where('number', '=', number)
    .executeTakeFirst();
  if (clash)
    throw conflict(
      `Invoice number ${number} already exists; adjust the next number in workspace settings`,
    );
  await saveSettings(ctx, ws.id, { ...ws.settings, nextInvoiceNumber: nextInvoiceNumber + 1 });
  return number;
}

async function insertLines(
  ctx: WorkspaceCtx,
  invoiceId: string,
  lines: ResolvedLine[],
  discountBp: number,
) {
  const totals = computeInvoiceTotals(lines, discountBp);
  await ctx.db
    .insertInto('invoice_lines')
    .values(
      lines.map((line, i) => ({
        id: line.id,
        invoice_id: invoiceId,
        position: i,
        description: line.description,
        quantity: line.quantity,
        unit_price_cents: line.unitPriceCents,
        tax_rate_id: line.taxRateId,
        tax_rate_bp: line.taxRateBp,
        account_id: line.accountId,
        line_total_cents: totals.lines[i]?.lineTotalCents ?? 0,
        tax_cents: totals.lines[i]?.taxCents ?? 0,
      })),
    )
    .execute();
  return totals;
}

export async function createInvoice(
  ctx: WorkspaceCtx,
  input: InvoiceInput,
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const { clientName } = await assertClientAndProject(tx, input.clientId, input.projectId);
    const lines = await resolveLines(tx, input.lines);
    const number = await allocateNumber(tx);
    const id = newId();
    const now = tx.clock.now();
    const totals = computeInvoiceTotals(lines, input.discountBp);
    await tx.db
      .insertInto('invoices')
      .values({
        id,
        workspace_id: tx.workspace.id,
        client_id: input.clientId,
        project_id: input.projectId,
        number,
        status: 'draft',
        issue_date: input.issueDate,
        due_date: input.dueDate,
        currency: tx.workspace.currency,
        discount_bp: input.discountBp,
        subtotal_cents: totals.subtotalCents,
        discount_cents: totals.discountCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents,
        amount_paid_cents: 0,
        notes: input.notes,
        terms: input.terms,
        po_number: input.poNumber,
        sent_at: null,
        approved_at: null,
        approved_by: null,
        voided_at: null,
        void_reason: '',
        created_by: tx.user.id,
        created_at: now,
        updated_at: now,
      })
      .execute();
    await insertLines(tx, id, lines, input.discountBp);
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} created draft ${number} for ${clientName} (${money(tx, totals.totalCents)})`,
      meta: { number, totalCents: totals.totalCents, clientId: input.clientId },
    });
    return getInvoiceDetail(tx, id);
  });
}

function assertMayEditDraft(
  ctx: WorkspaceCtx,
  invoice: Pick<InvoicesTable, 'status' | 'created_by' | 'number'>,
): void {
  if (invoice.status !== 'draft')
    throw invalidTransition(
      `${invoice.number} is ${invoice.status.replace('_', ' ')}; only drafts can be edited`,
    );
  if (invoice.created_by !== ctx.user.id && !can(ctx.role, 'invoices.approve'))
    throw forbidden('You can only edit your own draft invoices');
}

/** Replace a draft's lines. Time entries linked to retained line ids stay linked; the rest unlink. */
export async function updateInvoice(
  ctx: WorkspaceCtx,
  id: string,
  input: InvoiceInput,
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('invoices')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Invoice');
    assertMayEditDraft(tx, existing);
    const { clientName } = await assertClientAndProject(tx, input.clientId, input.projectId);
    const lines = await resolveLines(tx, input.lines);

    const oldLines = await tx.db
      .selectFrom('invoice_lines')
      .select('id')
      .where('invoice_id', '=', id)
      .execute();
    const oldIds = new Set(oldLines.map((l) => l.id));
    const keptIds = lines.map((l) => l.id).filter((lineId) => oldIds.has(lineId));
    const linked = keptIds.length
      ? await tx.db
          .selectFrom('time_entries')
          .select(['id', 'invoice_line_id'])
          .where('invoice_line_id', 'in', keptIds)
          .execute()
      : [];
    // Deleting the lines nulls invoice_line_id on every linked entry (FK ON DELETE SET NULL).
    await tx.db.deleteFrom('invoice_lines').where('invoice_id', '=', id).execute();
    const totals = await insertLines(tx, id, lines, input.discountBp);
    for (const entry of linked) {
      await tx.db
        .updateTable('time_entries')
        .set({ invoice_line_id: entry.invoice_line_id })
        .where('id', '=', entry.id)
        .execute();
    }
    await tx.db
      .updateTable('invoices')
      .set({
        client_id: input.clientId,
        project_id: input.projectId,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        discount_bp: input.discountBp,
        subtotal_cents: totals.subtotalCents,
        discount_cents: totals.discountCents,
        tax_cents: totals.taxCents,
        total_cents: totals.totalCents,
        notes: input.notes,
        terms: input.terms,
        po_number: input.poNumber,
        updated_at: tx.clock.now(),
      })
      .where('id', '=', id)
      .execute();
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'updated',
      summary: `${tx.user.name} edited ${existing.number} for ${clientName} (${money(tx, totals.totalCents)})`,
      meta: { number: existing.number, totalCents: totals.totalCents },
    });
    return getInvoiceDetail(tx, id);
  });
}

export async function deleteInvoice(ctx: WorkspaceCtx, id: string): Promise<void> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('invoices')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Invoice');
    if (existing.status !== 'draft')
      throw invalidTransition(
        `${existing.number} is ${existing.status.replace('_', ' ')}; only drafts can be deleted`,
      );
    if (existing.created_by !== tx.user.id && !can(tx.role, 'invoices.approve'))
      throw forbidden('You can only delete your own draft invoices');
    // Lines cascade, which releases linked time entries back to "unbilled".
    await tx.db
      .deleteFrom('approvals')
      .where('subject_type', '=', 'invoice')
      .where('subject_id', '=', id)
      .execute();
    await tx.db.deleteFrom('invoices').where('id', '=', id).execute();
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'deleted',
      summary: `${tx.user.name} deleted draft ${existing.number}`,
      meta: { number: existing.number },
    });
  });
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

async function loadForTransition(ctx: WorkspaceCtx, id: string): Promise<InvoiceRow> {
  return loadRow(ctx, id);
}

function link(ctx: WorkspaceCtx, id: string): string {
  return `/w/${ctx.workspace.slug}/invoices/${id}`;
}

function money(ctx: WorkspaceCtx, cents: number): string {
  return formatMoney(cents, ctx.workspace.currency);
}

export async function submitInvoice(ctx: WorkspaceCtx, id: string): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const inv = await loadForTransition(tx, id);
    if (!canTransition(inv.status, 'pending_approval'))
      throw invalidTransition(
        `${inv.number} cannot be submitted from ${inv.status.replace('_', ' ')}`,
      );
    if (inv.created_by !== tx.user.id && !can(tx.role, 'invoices.approve'))
      throw forbidden('You can only submit your own invoices');
    await tx.db
      .updateTable('invoices')
      .set({ status: 'pending_approval', updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    await requestApproval(tx, 'invoice', id);
    const approvers = await membersWithPermission(
      tx,
      tx.workspace.id,
      'invoices.approve',
      tx.user.id,
    );
    await notify(tx, {
      userIds: approvers,
      kind: 'approval_requested',
      title: `${inv.number} needs approval`,
      body: `${tx.user.name} submitted ${inv.number} for ${inv.client_name ?? ''} (${money(tx, inv.total_cents)}).`,
      link: link(tx, id),
    });
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'submitted',
      summary: `${tx.user.name} submitted ${inv.number} for approval`,
      meta: { number: inv.number },
    });
    return getInvoiceDetail(tx, id);
  });
}

export async function approveInvoice(
  ctx: WorkspaceCtx,
  id: string,
  comment = '',
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const inv = await loadForTransition(tx, id);
    if (!canTransition(inv.status, 'approved'))
      throw invalidTransition(
        `${inv.number} cannot be approved from ${inv.status.replace('_', ' ')}`,
      );
    const lines = await tx.db
      .selectFrom('invoice_lines')
      .selectAll()
      .where('invoice_id', '=', id)
      .orderBy('position')
      .execute();
    const clientName = inv.client_name ?? '';
    const entry = await postEntry(tx, {
      date: inv.issue_date,
      memo: `Invoice ${inv.number} — ${clientName}`,
      sourceType: 'invoice',
      sourceId: id,
      lines: postingsForInvoice({
        number: inv.number,
        clientName,
        totalCents: inv.total_cents,
        taxCents: inv.tax_cents,
        lines: lines.map((l) => ({
          accountId: l.account_id,
          lineTotalCents: l.line_total_cents,
          description: l.description,
        })),
      }),
    });
    const now = tx.clock.now();
    await tx.db
      .updateTable('invoices')
      .set({ status: 'approved', approved_at: now, approved_by: tx.user.id, updated_at: now })
      .where('id', '=', id)
      .execute();
    const { requestedBy } = await decideApproval(tx, 'invoice', id, 'approved', comment);
    if (requestedBy) {
      await notify(tx, {
        userIds: [requestedBy],
        kind: 'approval_decided',
        title: `${inv.number} was approved`,
        body: `${tx.user.name} approved ${inv.number} for ${clientName}.${comment ? ` "${comment}"` : ''}`,
        link: link(tx, id),
      });
    }
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'approved',
      summary: `${tx.user.name} approved ${inv.number} for ${clientName}`,
      meta: { number: inv.number, journalEntryId: entry.id, comment },
    });
    return getInvoiceDetail(tx, id);
  });
}

export async function rejectInvoice(
  ctx: WorkspaceCtx,
  id: string,
  comment: string,
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const inv = await loadForTransition(tx, id);
    if (inv.status !== 'pending_approval')
      throw invalidTransition(`${inv.number} is not awaiting approval`);
    await tx.db
      .updateTable('invoices')
      .set({ status: 'draft', updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    const { requestedBy } = await decideApproval(tx, 'invoice', id, 'rejected', comment);
    if (requestedBy) {
      await notify(tx, {
        userIds: [requestedBy],
        kind: 'approval_decided',
        title: `${inv.number} was sent back`,
        body: `${tx.user.name} rejected ${inv.number}: "${comment}"`,
        link: link(tx, id),
      });
    }
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'rejected',
      summary: `${tx.user.name} rejected ${inv.number}: ${comment}`,
      meta: { number: inv.number, comment },
    });
    return getInvoiceDetail(tx, id);
  });
}

export async function sendInvoice(ctx: WorkspaceCtx, id: string): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const inv = await loadForTransition(tx, id);
    if (!canTransition(inv.status, 'sent'))
      throw invalidTransition(`${inv.number} cannot be sent from ${inv.status.replace('_', ' ')}`);
    const now = tx.clock.now();
    await tx.db
      .updateTable('invoices')
      .set({ status: 'sent', sent_at: now, updated_at: now })
      .where('id', '=', id)
      .execute();
    if (inv.created_by !== tx.user.id) {
      await notify(tx, {
        userIds: [inv.created_by],
        kind: 'invoice_sent',
        title: `${inv.number} was sent`,
        body: `${tx.user.name} sent ${inv.number} to ${inv.client_name ?? ''} (${money(tx, inv.total_cents)}).`,
        link: link(tx, id),
      });
    }
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'sent',
      summary: `${tx.user.name} sent ${inv.number} to ${inv.client_name ?? ''}`,
      meta: { number: inv.number },
    });
    return getInvoiceDetail(tx, id);
  });
}

export async function voidInvoice(
  ctx: WorkspaceCtx,
  id: string,
  reason: string,
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const inv = await loadForTransition(tx, id);
    if (inv.status === 'paid')
      throw invalidTransition(`${inv.number} has been paid and cannot be voided`);
    if (!canTransition(inv.status, 'void'))
      throw invalidTransition(`${inv.number} is already void`);
    const now = tx.clock.now();
    let reversalId: string | null = null;
    if (isPostedInvoice(inv.status)) {
      const entryId = await findEntryForSource(tx, tx.workspace.id, 'invoice', id);
      if (entryId) {
        const reversal = await reverseEntry(tx, entryId, {
          date: tx.clock.today(),
          memo: `Void ${inv.number} — ${reason}`,
        });
        reversalId = reversal.id;
      }
    }
    await tx.db
      .updateTable('invoices')
      .set({ status: 'void', voided_at: now, void_reason: reason, updated_at: now })
      .where('id', '=', id)
      .execute();
    // Release time so it can be billed again.
    const lineIds = (
      await tx.db.selectFrom('invoice_lines').select('id').where('invoice_id', '=', id).execute()
    ).map((l) => l.id);
    if (lineIds.length)
      await tx.db
        .updateTable('time_entries')
        .set({ invoice_line_id: null })
        .where('invoice_line_id', 'in', lineIds)
        .execute();
    await tx.db
      .updateTable('approvals')
      .set({
        status: 'rejected',
        decided_by: tx.user.id,
        decided_at: now,
        comment: `Voided: ${reason}`,
      })
      .where('subject_type', '=', 'invoice')
      .where('subject_id', '=', id)
      .where('status', '=', 'pending')
      .execute();
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: id,
      action: 'voided',
      summary: `${tx.user.name} voided ${inv.number}: ${reason}`,
      meta: { number: inv.number, reason, reversalEntryId: reversalId },
    });
    return getInvoiceDetail(tx, id);
  });
}

// ---------------------------------------------------------------------------
// From time entries
// ---------------------------------------------------------------------------

export async function createInvoiceFromTime(
  ctx: WorkspaceCtx,
  input: InvoiceFromTimeInput,
): Promise<InvoiceDetailDto> {
  return withTransaction(ctx, async (tx) => {
    const { paymentTermsDays } = await assertClientAndProject(tx, input.clientId, input.projectId);
    const entries = await tx.db
      .selectFrom('time_entries as t')
      .innerJoin('projects as p', 'p.id', 't.project_id')
      .select([
        't.id',
        't.date',
        't.minutes',
        't.description',
        't.billable',
        't.invoice_line_id',
        'p.id as project_id',
        'p.name as project_name',
        'p.client_id',
        'p.hourly_rate_cents',
      ])
      .where('t.workspace_id', '=', tx.workspace.id)
      .where('t.id', 'in', input.entryIds)
      .execute();
    if (entries.length !== input.entryIds.length)
      throw fieldError('entryIds', 'Some time entries could not be found');
    for (const e of entries) {
      if (!e.billable) throw fieldError('entryIds', 'Only billable time can be invoiced');
      if (e.invoice_line_id)
        throw fieldError('entryIds', 'Some time entries have already been invoiced');
      if (e.client_id !== input.clientId)
        throw fieldError('entryIds', 'All time entries must belong to the selected client');
      if (input.projectId && e.project_id !== input.projectId)
        throw fieldError('entryIds', 'All time entries must belong to the selected project');
    }
    entries.sort(
      (a, b) => a.date.localeCompare(b.date) || a.project_name.localeCompare(b.project_name),
    );

    const groups = new Map<
      string,
      { description: string; minutes: number; rate: number; entryIds: string[] }
    >();
    for (const e of entries) {
      const key =
        input.groupBy === 'entry'
          ? e.id
          : input.groupBy === 'day'
            ? `${e.project_id}|${e.date}`
            : e.project_id;
      const description =
        input.groupBy === 'entry'
          ? `${e.date} — ${e.description || e.project_name}`
          : input.groupBy === 'day'
            ? `${e.project_name} — ${e.date}`
            : `${e.project_name} — professional services`;
      const group = groups.get(key) ?? {
        description,
        minutes: 0,
        rate: e.hourly_rate_cents,
        entryIds: [],
      };
      group.minutes += e.minutes;
      group.entryIds.push(e.id);
      groups.set(key, group);
    }

    const revenueAccount = await systemAccountId(tx, tx.workspace.id, 'services_revenue');
    const defaultTax = await taxRateBp(tx, tx.workspace.id, tx.workspace.settings.defaultTaxRateId);
    const lineInputs: InvoiceLineInput[] = [];
    const lineEntryIds: string[][] = [];
    for (const group of groups.values()) {
      const hours = Math.round((group.minutes / 60) * 100) / 100;
      lineInputs.push({
        id: newId(),
        description: group.description,
        quantity: hours > 0 ? hours : 0.01,
        unitPriceCents: group.rate,
        taxRateId: defaultTax?.id ?? null,
        accountId: revenueAccount,
      });
      lineEntryIds.push(group.entryIds);
    }

    const issueDate = input.issueDate ?? tx.clock.today();
    const dueDate = input.dueDate ?? addDays(issueDate, paymentTermsDays);
    if (dueDate < issueDate)
      throw fieldError('dueDate', 'Due date cannot be before the issue date');
    const detail = await createInvoice(tx, {
      clientId: input.clientId,
      projectId: input.projectId,
      issueDate,
      dueDate,
      discountBp: 0,
      notes: '',
      terms: '',
      poNumber: '',
      lines: lineInputs,
    });
    for (const [i, line] of lineInputs.entries()) {
      const ids = lineEntryIds[i] ?? [];
      if (ids.length && line.id) {
        await tx.db
          .updateTable('time_entries')
          .set({ invoice_line_id: line.id })
          .where('id', 'in', ids)
          .execute();
      }
    }
    const minutes = entries.reduce((s, e) => s + e.minutes, 0);
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: detail.id,
      action: 'created_from_time',
      summary: `${tx.user.name} billed ${Math.round(minutes / 6) / 10}h of time on ${detail.number}`,
      meta: {
        entryCount: entries.length,
        minutes,
        valueCents: entries.reduce((s, e) => s + billableAmount(e.minutes, e.hourly_rate_cents), 0),
      },
    });
    return getInvoiceDetail(tx, detail.id);
  });
}
