import {
  billableAmount,
  isOpenInvoice,
  OPEN_INVOICE_STATUSES,
  POSTED_INVOICE_STATUSES,
  diffDays,
  type ClientDto,
  type ClientInput,
  type ClientStats,
  type InvoiceDto,
  type Paginated,
  type ProjectDto,
} from '@ledgerline/shared';
import { sql, type ExpressionBuilder } from 'kysely';
import type { Database } from '../db/schema';
import { notFound } from '../errors';
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
import { mapClient, mapInvoice } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type WorkspaceCtx } from './context';
import { listProjects } from './projects';

/** Subqueries that decorate a client row with the aggregates `ClientDto` carries. */
function clientAggregates(eb: ExpressionBuilder<Database, 'clients'>) {
  return [
    eb
      .selectFrom('invoices as i')
      .select(sql<number>`coalesce(sum(i.total_cents - i.amount_paid_cents), 0)`.as('v'))
      .whereRef('i.client_id', '=', 'clients.id')
      .where('i.status', 'in', OPEN_INVOICE_STATUSES)
      .as('outstanding_cents'),
    eb
      .selectFrom('invoices as i')
      .select(eb.fn.countAll<number>().as('v'))
      .whereRef('i.client_id', '=', 'clients.id')
      .where('i.status', '!=', 'void')
      .as('invoice_count'),
    eb
      .selectFrom('projects as p')
      .select(eb.fn.countAll<number>().as('v'))
      .whereRef('p.client_id', '=', 'clients.id')
      .as('project_count'),
  ];
}

const CLIENT_SORTS: Record<string, SortSpec> = {
  name: [['clients.name', 'asc']],
  company: [['clients.company', 'asc']],
  country: [['clients.country', 'asc']],
  paymentTermsDays: [['clients.payment_terms_days', 'asc']],
  outstanding: [['outstanding_cents', 'desc']],
  createdAt: [
    ['clients.created_at', 'desc'],
    ['clients.rowid', 'desc'],
  ],
  updatedAt: [['clients.updated_at', 'desc']],
};

export interface ClientListQuery extends PageInput, SortInput {
  q?: string;
  status?: 'active' | 'archived' | 'all';
}

export async function listClients(
  ctx: WorkspaceCtx,
  query: ClientListQuery,
): Promise<Paginated<ClientDto>> {
  const page = resolvePage(query);
  let base = ctx.db.selectFrom('clients').where('clients.workspace_id', '=', ctx.workspace.id);
  const status = query.status ?? 'active';
  if (status !== 'all') base = base.where('clients.status', '=', status);
  if (query.q) {
    const like = likeContains(query.q);
    base = base.where((eb) =>
      eb.or([
        eb('clients.name', 'like', like),
        eb('clients.company', 'like', like),
        eb('clients.email', 'like', like),
      ]),
    );
  }
  const sort = resolveSort(query, CLIENT_SORTS, 'name', ['clients.id', 'asc']);
  let select = base.selectAll('clients').select(clientAggregates);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    select.limit(page.pageSize).offset(page.offset).execute(),
  ]);
  return paginated(rows.map(mapClient), Number(total), page);
}

export async function getClient(ctx: WorkspaceCtx, id: string): Promise<ClientDto> {
  const row = await ctx.db
    .selectFrom('clients')
    .selectAll('clients')
    .select(clientAggregates)
    .where('clients.id', '=', id)
    .where('clients.workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!row) throw notFound('Client');
  return mapClient(row);
}

export async function clientInvoices(ctx: WorkspaceCtx, clientId: string): Promise<InvoiceDto[]> {
  const rows = await ctx.db
    .selectFrom('invoices as i')
    .leftJoin('clients as c', 'c.id', 'i.client_id')
    .leftJoin('projects as p', 'p.id', 'i.project_id')
    .selectAll('i')
    .select(['c.name as client_name', 'p.name as project_name'])
    .where('i.workspace_id', '=', ctx.workspace.id)
    .where('i.client_id', '=', clientId)
    .orderBy('i.issue_date', 'desc')
    .orderBy('i.number', 'desc')
    .execute();
  const today = ctx.clock.today();
  return rows.map((r) => mapInvoice(r, today));
}

export async function clientStats(ctx: WorkspaceCtx, clientId: string): Promise<ClientStats> {
  const today = ctx.clock.today();
  const invoices = await ctx.db
    .selectFrom('invoices')
    .select(['id', 'status', 'issue_date', 'due_date', 'total_cents', 'amount_paid_cents'])
    .where('workspace_id', '=', ctx.workspace.id)
    .where('client_id', '=', clientId)
    .where('status', 'in', POSTED_INVOICE_STATUSES)
    .execute();
  const paidIds = invoices.filter((i) => i.status === 'paid').map((i) => i.id);
  const lastPayments =
    paidIds.length > 0
      ? await ctx.db
          .selectFrom('payments')
          .select((eb) => ['invoice_id', eb.fn.max('date').as('last_date')])
          .where('invoice_id', 'in', paidIds)
          .groupBy('invoice_id')
          .execute()
      : [];
  const lastPaymentByInvoice = new Map(
    lastPayments.map((p) => [p.invoice_id, String(p.last_date)] as const),
  );

  let invoicedCents = 0;
  let paidCents = 0;
  let outstandingCents = 0;
  let overdueCents = 0;
  const daysToPay: number[] = [];
  for (const inv of invoices) {
    invoicedCents += inv.total_cents;
    paidCents += inv.amount_paid_cents;
    const balance = Math.max(0, inv.total_cents - inv.amount_paid_cents);
    if (isOpenInvoice(inv.status)) {
      outstandingCents += balance;
      if (inv.due_date < today) overdueCents += balance;
    }
    const last = lastPaymentByInvoice.get(inv.id);
    if (inv.status === 'paid' && last) daysToPay.push(Math.max(0, diffDays(inv.issue_date, last)));
  }

  const unbilled = await ctx.db
    .selectFrom('time_entries as t')
    .innerJoin('projects as p', 'p.id', 't.project_id')
    .select(['t.minutes', 'p.hourly_rate_cents'])
    .where('t.workspace_id', '=', ctx.workspace.id)
    .where('p.client_id', '=', clientId)
    .where('t.billable', '=', 1)
    .where('t.invoice_line_id', 'is', null)
    .execute();
  const unbilledMinutes = unbilled.reduce((s, e) => s + e.minutes, 0);
  const unbilledCents = unbilled.reduce(
    (s, e) => s + billableAmount(e.minutes, e.hourly_rate_cents),
    0,
  );

  return {
    invoicedCents,
    paidCents,
    outstandingCents,
    overdueCents,
    invoiceCount: invoices.length,
    averageDaysToPay:
      daysToPay.length > 0
        ? Math.round(daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length)
        : null,
    unbilledMinutes,
    unbilledCents,
  };
}

export async function getClientDetail(
  ctx: WorkspaceCtx,
  id: string,
): Promise<{
  client: ClientDto;
  stats: ClientStats;
  projects: ProjectDto[];
  invoices: InvoiceDto[];
}> {
  const client = await getClient(ctx, id);
  const [stats, projects, invoices] = await Promise.all([
    clientStats(ctx, id),
    listProjects(ctx, { clientId: id, status: 'all', pageSize: 200 }),
    clientInvoices(ctx, id),
  ]);
  return { client, stats, projects: projects.items, invoices };
}

function toRow(input: ClientInput) {
  return {
    name: input.name,
    company: input.company,
    email: input.email,
    phone: input.phone,
    address_line1: input.addressLine1,
    address_line2: input.addressLine2,
    city: input.city,
    region: input.region,
    postal_code: input.postalCode,
    country: input.country,
    tax_id: input.taxId,
    payment_terms_days: input.paymentTermsDays,
    notes: input.notes,
    status: input.status,
  };
}

export async function createClient(ctx: WorkspaceCtx, input: ClientInput): Promise<ClientDto> {
  return withTransaction(ctx, async (tx) => {
    const id = newId();
    const now = tx.clock.now();
    await tx.db
      .insertInto('clients')
      .values({
        id,
        workspace_id: tx.workspace.id,
        ...toRow(input),
        created_at: now,
        updated_at: now,
      })
      .execute();
    await logActivity(tx, {
      entityType: 'client',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} added client ${input.name}`,
    });
    return getClient(tx, id);
  });
}

export async function updateClient(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<ClientInput>,
): Promise<ClientDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('clients')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Client');
    const merged: ClientInput = {
      name: input.name ?? existing.name,
      company: input.company ?? existing.company,
      email: input.email ?? existing.email,
      phone: input.phone ?? existing.phone,
      addressLine1: input.addressLine1 ?? existing.address_line1,
      addressLine2: input.addressLine2 ?? existing.address_line2,
      city: input.city ?? existing.city,
      region: input.region ?? existing.region,
      postalCode: input.postalCode ?? existing.postal_code,
      country: input.country ?? existing.country,
      taxId: input.taxId ?? existing.tax_id,
      paymentTermsDays: input.paymentTermsDays ?? existing.payment_terms_days,
      notes: input.notes ?? existing.notes,
      status: input.status ?? existing.status,
    };
    await tx.db
      .updateTable('clients')
      .set({ ...toRow(merged), updated_at: tx.clock.now() })
      .where('id', '=', id)
      .execute();
    const action =
      input.status && input.status !== existing.status
        ? input.status === 'archived'
          ? 'archived'
          : 'restored'
        : 'updated';
    await logActivity(tx, {
      entityType: 'client',
      entityId: id,
      action,
      summary: `${tx.user.name} ${action} client ${merged.name}`,
      meta: { fields: Object.keys(input) },
    });
    return getClient(tx, id);
  });
}

/** DELETE archives rather than removing, so invoices keep their counterparty. */
export async function archiveClient(ctx: WorkspaceCtx, id: string): Promise<ClientDto> {
  return updateClient(ctx, id, { status: 'archived' });
}
