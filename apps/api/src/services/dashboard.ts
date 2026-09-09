import {
  addDays,
  billableAmount,
  buildAgingReport,
  buildProfitAndLoss,
  POSTED_INVOICE_STATUSES,
  previousRange,
  rangeForPeriod,
  shareBp,
  splitByMonth,
  type DashboardDto,
  type DashboardRange,
} from '@ledgerline/shared';
import { listActivity } from './activity';
import { pendingApprovalCount } from './approvals';
import { calendarEvents } from './calendar';
import type { WorkspaceCtx } from './context';
import { listInvoices } from './invoices';
import { accountList, ledgerLines, openInvoices } from './reports';

export async function dashboard(
  ctx: WorkspaceCtx,
  rangeKey: DashboardRange = 'month',
): Promise<DashboardDto> {
  const today = ctx.clock.today();
  const ws = ctx.workspace.id;
  const range = rangeForPeriod(today, rangeKey);
  const previous = previousRange(range);

  const [
    lines,
    accounts,
    open,
    payments,
    paidExpenses,
    unbilled,
    draftCount,
    pendingCount,
    topRows,
    recent,
    activity,
    upcoming,
  ] = await Promise.all([
    ledgerLines(ctx, ws),
    accountList(ctx, ws),
    openInvoices(ctx, ws),
    ctx.db
      .selectFrom('payments')
      .select(['date', 'amount_cents'])
      .where('workspace_id', '=', ws)
      .where('date', '>=', range.from)
      .where('date', '<=', range.to)
      .execute(),
    ctx.db
      .selectFrom('expenses')
      .select(['paid_at', 'total_cents'])
      .where('workspace_id', '=', ws)
      .where('status', '=', 'paid')
      .where('paid_at', '>=', range.from)
      .where('paid_at', '<=', range.to)
      .execute(),
    ctx.db
      .selectFrom('time_entries as t')
      .innerJoin('projects as p', 'p.id', 't.project_id')
      .select(['t.minutes', 'p.hourly_rate_cents'])
      .where('t.workspace_id', '=', ws)
      .where('t.billable', '=', 1)
      .where('t.invoice_line_id', 'is', null)
      .execute(),
    ctx.db
      .selectFrom('invoices')
      .select((eb) => eb.fn.countAll<number>().as('c'))
      .where('workspace_id', '=', ws)
      .where('status', '=', 'draft')
      .executeTakeFirstOrThrow(),
    pendingApprovalCount(ctx, ws),
    ctx.db
      .selectFrom('invoices as i')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .select(['i.client_id', 'c.name', 'i.total_cents'])
      .where('i.workspace_id', '=', ws)
      .where('i.status', 'in', POSTED_INVOICE_STATUSES)
      .where('i.issue_date', '>=', range.from)
      .where('i.issue_date', '<=', range.to)
      .execute(),
    listInvoices(ctx, { pageSize: 5, sort: 'createdAt', dir: 'desc' }),
    listActivity(ctx, ws, { limit: 10 }),
    calendarEvents(ctx, { from: today, to: addDays(today, 14) }),
  ]);

  const pl = buildProfitAndLoss(lines, accounts, range, previous);
  const aging = buildAgingReport(open, today);
  const overdue = open.filter((i) => i.dueDate < today && i.status !== 'approved');

  const cashflow = splitByMonth(range).map((bucket) => ({
    label: bucket.label,
    from: bucket.from,
    to: bucket.to,
    inCents: payments
      .filter((p) => p.date >= bucket.from && p.date <= bucket.to)
      .reduce((s, p) => s + p.amount_cents, 0),
    outCents: paidExpenses
      .filter((e) => e.paid_at && e.paid_at >= bucket.from && e.paid_at <= bucket.to)
      .reduce((s, e) => s + e.total_cents, 0),
  }));

  const revenueByClient = new Map<
    string,
    { clientId: string; name: string; revenueCents: number }
  >();
  let revenueTotal = 0;
  for (const r of topRows) {
    const row = revenueByClient.get(r.client_id) ?? {
      clientId: r.client_id,
      name: r.name,
      revenueCents: 0,
    };
    row.revenueCents += r.total_cents;
    revenueTotal += r.total_cents;
    revenueByClient.set(r.client_id, row);
  }
  const topClients = [...revenueByClient.values()]
    .sort((a, b) => b.revenueCents - a.revenueCents)
    .slice(0, 5)
    .map((r) => ({ ...r, shareBp: shareBp(r.revenueCents, revenueTotal) }));

  return {
    range: rangeKey,
    from: range.from,
    to: range.to,
    today,
    currency: ctx.workspace.currency,
    kpis: {
      outstandingCents: open.reduce((s, i) => s + i.balanceCents, 0),
      overdueCents: overdue.reduce((s, i) => s + i.balanceCents, 0),
      overdueCount: overdue.length,
      revenueCents: pl.revenue.totalCents,
      previousRevenueCents: pl.revenue.previousTotalCents ?? 0,
      expensesCents: pl.expenses.totalCents,
      previousExpensesCents: pl.expenses.previousTotalCents ?? 0,
      netCents: pl.netIncomeCents,
      unbilledMinutes: unbilled.reduce((s, e) => s + e.minutes, 0),
      unbilledCents: unbilled.reduce(
        (s, e) => s + billableAmount(e.minutes, e.hourly_rate_cents),
        0,
      ),
      draftInvoiceCount: Number(draftCount.c),
      pendingApprovalCount: pendingCount,
    },
    cashflow,
    aging: aging.buckets.map((b) => ({
      bucket: b.bucket,
      label: b.label,
      amountCents: b.amountCents,
      count: b.count,
    })),
    topClients,
    recentInvoices: recent.items,
    recentActivity: activity,
    upcoming,
  };
}
