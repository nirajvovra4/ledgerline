import {
  billableAmount,
  buildAgingReport,
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  fiscalYearRange,
  isOpenInvoice,
  OPEN_INVOICE_STATUSES,
  POSTED_INVOICE_STATUSES,
  previousRange,
  shareBp,
  summariseTaxByRate,
  utilisationBp,
  type AccountLike,
  type AgingInput,
  type AgingReportDto,
  type BalanceSheetDto,
  type ClientStatementDto,
  type DateRange,
  type LedgerLineLike,
  type ProfitLossDto,
  type RevenueByClientDto,
  type TaxSummaryDto,
  type TimeUtilisationDto,
  type TrialBalanceDto,
} from '@ledgerline/shared';
import { getClient } from './clients';
import type { Ctx, WorkspaceCtx } from './context';

export interface RangeInput {
  from?: string;
  to?: string;
}

/** Default reporting window: fiscal year to date. */
export function resolveRange(ctx: WorkspaceCtx, input: RangeInput): DateRange {
  const today = ctx.clock.today();
  const fy = fiscalYearRange(today, ctx.workspace.settings.fiscalYearStartMonth);
  const from = input.from ?? fy.from;
  const to = input.to ?? (from > today ? from : today);
  return { from, to: to < from ? from : to };
}

/** Every journal line in the workspace with its entry date — the input to the shared builders. */
export async function ledgerLines(ctx: Ctx, workspaceId: string): Promise<LedgerLineLike[]> {
  const rows = await ctx.db
    .selectFrom('journal_lines as l')
    .innerJoin('journal_entries as e', 'e.id', 'l.entry_id')
    .select(['l.account_id', 'e.date', 'l.debit_cents', 'l.credit_cents'])
    .where('e.workspace_id', '=', workspaceId)
    .execute();
  return rows.map((r) => ({
    accountId: r.account_id,
    date: r.date,
    debitCents: r.debit_cents,
    creditCents: r.credit_cents,
  }));
}

export async function accountList(ctx: Ctx, workspaceId: string): Promise<AccountLike[]> {
  const rows = await ctx.db
    .selectFrom('accounts')
    .select(['id', 'code', 'name', 'type', 'parent_id'])
    .where('workspace_id', '=', workspaceId)
    .execute();
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    name: r.name,
    type: r.type,
    parentId: r.parent_id,
  }));
}

export async function profitLoss(
  ctx: WorkspaceCtx,
  input: RangeInput & { compare?: 'previous' | 'none' },
): Promise<ProfitLossDto> {
  const range = resolveRange(ctx, input);
  const compare = input.compare === 'previous' ? previousRange(range) : null;
  const [lines, accounts] = await Promise.all([
    ledgerLines(ctx, ctx.workspace.id),
    accountList(ctx, ctx.workspace.id),
  ]);
  return buildProfitAndLoss(lines, accounts, range, compare);
}

export async function balanceSheet(ctx: WorkspaceCtx, asOf?: string): Promise<BalanceSheetDto> {
  const [lines, accounts] = await Promise.all([
    ledgerLines(ctx, ctx.workspace.id),
    accountList(ctx, ctx.workspace.id),
  ]);
  return buildBalanceSheet(lines, accounts, asOf ?? ctx.clock.today());
}

export async function trialBalance(ctx: WorkspaceCtx, asOf?: string): Promise<TrialBalanceDto> {
  const [lines, accounts] = await Promise.all([
    ledgerLines(ctx, ctx.workspace.id),
    accountList(ctx, ctx.workspace.id),
  ]);
  return buildTrialBalance(lines, accounts, asOf ?? ctx.clock.today());
}

/** Open invoice balances, the input to the aging report and the dashboard KPIs. */
export async function openInvoices(
  ctx: Ctx,
  workspaceId: string,
  asOf?: string,
): Promise<Array<AgingInput & { invoiceId: string; status: string; issueDate: string }>> {
  let q = ctx.db
    .selectFrom('invoices as i')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .select([
      'i.id',
      'i.client_id',
      'c.name as client_name',
      'i.due_date',
      'i.issue_date',
      'i.status',
      'i.total_cents',
      'i.amount_paid_cents',
    ])
    .where('i.workspace_id', '=', workspaceId)
    .where('i.status', 'in', OPEN_INVOICE_STATUSES);
  if (asOf) q = q.where('i.issue_date', '<=', asOf);
  const rows = await q.execute();
  return rows.map((r) => ({
    invoiceId: r.id,
    clientId: r.client_id,
    clientName: r.client_name,
    dueDate: r.due_date,
    issueDate: r.issue_date,
    status: r.status,
    balanceCents: Math.max(0, r.total_cents - r.amount_paid_cents),
  }));
}

export async function arAging(ctx: WorkspaceCtx, asOf?: string): Promise<AgingReportDto> {
  const date = asOf ?? ctx.clock.today();
  return buildAgingReport(await openInvoices(ctx, ctx.workspace.id, date), date);
}

export async function taxSummary(ctx: WorkspaceCtx, input: RangeInput): Promise<TaxSummaryDto> {
  const range = resolveRange(ctx, input);
  const [collectedRows, paidRows] = await Promise.all([
    ctx.db
      .selectFrom('invoice_lines as l')
      .innerJoin('invoices as i', 'i.id', 'l.invoice_id')
      .leftJoin('tax_rates as t', 't.id', 'l.tax_rate_id')
      .select(['l.line_total_cents', 'l.tax_rate_id', 'l.tax_rate_bp', 't.name as tax_name'])
      .where('i.workspace_id', '=', ctx.workspace.id)
      .where('i.status', 'in', POSTED_INVOICE_STATUSES)
      .where('i.issue_date', '>=', range.from)
      .where('i.issue_date', '<=', range.to)
      .execute(),
    ctx.db
      .selectFrom('expenses as e')
      .leftJoin('tax_rates as t', 't.id', 'e.tax_rate_id')
      .select(['e.amount_cents', 'e.tax_rate_id', 'e.tax_rate_bp', 't.name as tax_name'])
      .where('e.workspace_id', '=', ctx.workspace.id)
      .where('e.status', '=', 'paid')
      .where('e.paid_at', '>=', range.from)
      .where('e.paid_at', '<=', range.to)
      .execute(),
  ]);
  const collected = summariseTaxByRate(
    collectedRows.map((r) => ({
      netCents: r.line_total_cents,
      taxRateId: r.tax_rate_id,
      taxRateBp: r.tax_rate_bp,
      taxRateName: r.tax_name ?? undefined,
    })),
  );
  const paid = summariseTaxByRate(
    paidRows.map((r) => ({
      netCents: r.amount_cents,
      taxRateId: r.tax_rate_id,
      taxRateBp: r.tax_rate_bp,
      taxRateName: r.tax_name ?? undefined,
    })),
  );
  const collectedCents = collected.reduce((s, r) => s + r.taxCents, 0);
  const paidCents = paid.reduce((s, r) => s + r.taxCents, 0);
  return {
    from: range.from,
    to: range.to,
    collected,
    paid,
    collectedCents,
    paidCents,
    netPayableCents: collectedCents - paidCents,
  };
}

export async function revenueByClient(
  ctx: WorkspaceCtx,
  input: RangeInput,
): Promise<RevenueByClientDto> {
  const range = resolveRange(ctx, input);
  const rows = await ctx.db
    .selectFrom('invoices as i')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .select(['i.client_id', 'c.name as client_name', 'i.total_cents', 'i.amount_paid_cents'])
    .where('i.workspace_id', '=', ctx.workspace.id)
    .where('i.status', 'in', POSTED_INVOICE_STATUSES)
    .where('i.issue_date', '>=', range.from)
    .where('i.issue_date', '<=', range.to)
    .execute();
  const byClient = new Map<string, RevenueByClientDto['rows'][number]>();
  let totalCents = 0;
  for (const r of rows) {
    const row = byClient.get(r.client_id) ?? {
      clientId: r.client_id,
      clientName: r.client_name,
      invoiceCount: 0,
      invoicedCents: 0,
      paidCents: 0,
      outstandingCents: 0,
      shareBp: 0,
    };
    row.invoiceCount += 1;
    row.invoicedCents += r.total_cents;
    row.paidCents += r.amount_paid_cents;
    row.outstandingCents += Math.max(0, r.total_cents - r.amount_paid_cents);
    totalCents += r.total_cents;
    byClient.set(r.client_id, row);
  }
  const out = [...byClient.values()]
    .map((r) => ({ ...r, shareBp: shareBp(r.invoicedCents, totalCents) }))
    .sort((a, b) => b.invoicedCents - a.invoicedCents);
  return { from: range.from, to: range.to, rows: out, totalCents };
}

export async function timeUtilisation(
  ctx: WorkspaceCtx,
  input: RangeInput,
): Promise<TimeUtilisationDto> {
  const range = resolveRange(ctx, input);
  const rows = await ctx.db
    .selectFrom('time_entries as t')
    .innerJoin('users as u', 'u.id', 't.user_id')
    .innerJoin('projects as p', 'p.id', 't.project_id')
    .select(['t.user_id', 'u.name', 't.minutes', 't.billable', 'p.hourly_rate_cents'])
    .where('t.workspace_id', '=', ctx.workspace.id)
    .where('t.date', '>=', range.from)
    .where('t.date', '<=', range.to)
    .execute();
  const byUser = new Map<string, TimeUtilisationDto['rows'][number]>();
  let totalMinutes = 0;
  let billableMinutes = 0;
  for (const r of rows) {
    const row = byUser.get(r.user_id) ?? {
      userId: r.user_id,
      name: r.name,
      minutes: 0,
      billableMinutes: 0,
      utilisationBp: 0,
      billableValueCents: 0,
    };
    row.minutes += r.minutes;
    totalMinutes += r.minutes;
    if (r.billable) {
      row.billableMinutes += r.minutes;
      billableMinutes += r.minutes;
      row.billableValueCents += billableAmount(r.minutes, r.hourly_rate_cents);
    }
    byUser.set(r.user_id, row);
  }
  const out = [...byUser.values()]
    .map((r) => ({ ...r, utilisationBp: utilisationBp(r.billableMinutes, r.minutes) }))
    .sort((a, b) => b.minutes - a.minutes);
  return {
    from: range.from,
    to: range.to,
    rows: out,
    totalMinutes,
    billableMinutes,
    utilisationBp: utilisationBp(billableMinutes, totalMinutes),
  };
}

/** Invoices (debits) and payments (credits) for one client with a running balance. */
export async function clientStatement(
  ctx: WorkspaceCtx,
  clientId: string,
  input: RangeInput,
): Promise<ClientStatementDto> {
  const client = await getClient(ctx, clientId);
  const range = resolveRange(ctx, input);
  const [invoices, payments] = await Promise.all([
    ctx.db
      .selectFrom('invoices')
      .select(['id', 'number', 'issue_date', 'total_cents', 'status', 'po_number'])
      .where('workspace_id', '=', ctx.workspace.id)
      .where('client_id', '=', clientId)
      .where('status', 'in', POSTED_INVOICE_STATUSES)
      .where('issue_date', '<=', range.to)
      .execute(),
    ctx.db
      .selectFrom('payments as pm')
      .innerJoin('invoices as i', 'i.id', 'pm.invoice_id')
      .select([
        'pm.id',
        'pm.date',
        'pm.amount_cents',
        'pm.method',
        'pm.reference',
        'i.number',
        'i.id as invoice_id',
        'i.status',
      ])
      .where('pm.workspace_id', '=', ctx.workspace.id)
      .where('i.client_id', '=', clientId)
      .where('i.status', 'in', POSTED_INVOICE_STATUSES)
      .where('pm.date', '<=', range.to)
      .execute(),
  ]);
  const base = `/w/${ctx.workspace.slug}/invoices/`;
  type Row = ClientStatementDto['rows'][number];
  const all: Array<Row & { sortKey: string }> = [
    ...invoices.map((i) => ({
      date: i.issue_date,
      kind: 'invoice' as const,
      reference: i.number,
      description: `Invoice ${i.number}${i.po_number ? ` (PO ${i.po_number})` : ''}${isOpenInvoice(i.status) ? '' : ' — paid'}`,
      debitCents: i.total_cents,
      creditCents: 0,
      balanceCents: 0,
      link: `${base}${i.id}`,
      sortKey: `${i.issue_date}|0|${i.number}`,
    })),
    ...payments.map((p) => ({
      date: p.date,
      kind: 'payment' as const,
      reference: p.reference || p.method.replace('_', ' '),
      description: `Payment for ${p.number}`,
      debitCents: 0,
      creditCents: p.amount_cents,
      balanceCents: 0,
      link: `${base}${p.invoice_id}`,
      sortKey: `${p.date}|1|${p.number}`,
    })),
  ].sort((a, b) => a.sortKey.localeCompare(b.sortKey));

  let balance = 0;
  let openingBalanceCents = 0;
  const rows: Row[] = [];
  for (const row of all) {
    balance += row.debitCents - row.creditCents;
    if (row.date < range.from) {
      openingBalanceCents = balance;
      continue;
    }
    const { sortKey: _sortKey, ...rest } = row;
    rows.push({ ...rest, balanceCents: balance });
  }
  return {
    client,
    from: range.from,
    to: range.to,
    openingBalanceCents,
    closingBalanceCents: balance,
    rows,
  };
}
