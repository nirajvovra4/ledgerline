import {
  OPEN_INVOICE_STATUSES,
  POSTED_INVOICE_STATUSES,
  formatMoney,
  monthRange,
  parseMonthKey,
  type CalendarEvent,
  type DateRange,
} from '@ledgerline/shared';
import { fieldError } from '../errors';
import type { WorkspaceCtx } from './context';

/** Every dated business event in the window: invoice due/issued, payments, expenses, projects. */
export async function calendarEvents(
  ctx: WorkspaceCtx,
  range: DateRange,
): Promise<CalendarEvent[]> {
  const ws = ctx.workspace.id;
  const today = ctx.clock.today();
  const money = (cents: number) => formatMoney(cents, ctx.workspace.currency);
  const base = `/w/${ctx.workspace.slug}`;
  const [invoices, payments, expenses, projects] = await Promise.all([
    ctx.db
      .selectFrom('invoices as i')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .select([
        'i.id',
        'i.number',
        'i.status',
        'i.issue_date',
        'i.due_date',
        'i.total_cents',
        'i.amount_paid_cents',
        'c.name as client_name',
      ])
      .where('i.workspace_id', '=', ws)
      .where('i.status', 'in', POSTED_INVOICE_STATUSES)
      .where((eb) =>
        eb.or([
          eb.and([eb('i.issue_date', '>=', range.from), eb('i.issue_date', '<=', range.to)]),
          eb.and([eb('i.due_date', '>=', range.from), eb('i.due_date', '<=', range.to)]),
        ]),
      )
      .execute(),
    ctx.db
      .selectFrom('payments as pm')
      .innerJoin('invoices as i', 'i.id', 'pm.invoice_id')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .select([
        'pm.id',
        'pm.date',
        'pm.amount_cents',
        'i.id as invoice_id',
        'i.number',
        'c.name as client_name',
      ])
      .where('pm.workspace_id', '=', ws)
      .where('pm.date', '>=', range.from)
      .where('pm.date', '<=', range.to)
      .execute(),
    ctx.db
      .selectFrom('expenses')
      .select(['id', 'vendor', 'description', 'status', 'due_date', 'paid_at', 'total_cents'])
      .where('workspace_id', '=', ws)
      .where('status', 'in', ['approved', 'paid'])
      .where((eb) =>
        eb.or([
          eb.and([eb('due_date', '>=', range.from), eb('due_date', '<=', range.to)]),
          eb.and([eb('paid_at', '>=', range.from), eb('paid_at', '<=', range.to)]),
        ]),
      )
      .execute(),
    ctx.db
      .selectFrom('projects as p')
      .innerJoin('clients as c', 'c.id', 'p.client_id')
      .select(['p.id', 'p.name', 'p.start_date', 'p.end_date', 'c.name as client_name'])
      .where('p.workspace_id', '=', ws)
      .where('p.status', '!=', 'archived')
      .where((eb) =>
        eb.or([
          eb.and([eb('p.start_date', '>=', range.from), eb('p.start_date', '<=', range.to)]),
          eb.and([eb('p.end_date', '>=', range.from), eb('p.end_date', '<=', range.to)]),
        ]),
      )
      .execute(),
  ]);

  const events: CalendarEvent[] = [];
  for (const i of invoices) {
    const balance = i.total_cents - i.amount_paid_cents;
    if (i.issue_date >= range.from && i.issue_date <= range.to) {
      events.push({
        id: `invoice_issued:${i.id}`,
        kind: 'invoice_issued',
        date: i.issue_date,
        title: `${i.number} issued`,
        subtitle: i.client_name,
        amountCents: i.total_cents,
        link: `${base}/invoices/${i.id}`,
        tone: 'neutral',
      });
    }
    if (
      i.due_date >= range.from &&
      i.due_date <= range.to &&
      OPEN_INVOICE_STATUSES.includes(i.status)
    ) {
      const overdue = i.due_date < today;
      events.push({
        id: `invoice_due:${i.id}`,
        kind: 'invoice_due',
        date: i.due_date,
        title: `${i.number} ${overdue ? 'overdue' : 'due'}`,
        subtitle: `${i.client_name} · ${money(balance)} outstanding`,
        amountCents: balance,
        link: `${base}/invoices/${i.id}`,
        tone: overdue ? 'negative' : 'warning',
      });
    }
  }
  for (const p of payments) {
    events.push({
      id: `payment_received:${p.id}`,
      kind: 'payment_received',
      date: p.date,
      title: `Payment for ${p.number}`,
      subtitle: p.client_name,
      amountCents: p.amount_cents,
      link: `${base}/invoices/${p.invoice_id}`,
      tone: 'positive',
    });
  }
  for (const e of expenses) {
    if (
      e.status === 'approved' &&
      e.due_date &&
      e.due_date >= range.from &&
      e.due_date <= range.to
    ) {
      events.push({
        id: `expense_due:${e.id}`,
        kind: 'expense_due',
        date: e.due_date,
        title: `${e.vendor} due`,
        subtitle: e.description,
        amountCents: e.total_cents,
        link: `${base}/expenses/${e.id}`,
        tone: e.due_date < today ? 'negative' : 'warning',
      });
    }
    if (e.status === 'paid' && e.paid_at && e.paid_at >= range.from && e.paid_at <= range.to) {
      events.push({
        id: `expense_paid:${e.id}`,
        kind: 'expense_paid',
        date: e.paid_at,
        title: `Paid ${e.vendor}`,
        subtitle: e.description,
        amountCents: e.total_cents,
        link: `${base}/expenses/${e.id}`,
        tone: 'neutral',
      });
    }
  }
  for (const p of projects) {
    if (p.start_date && p.start_date >= range.from && p.start_date <= range.to) {
      events.push({
        id: `project_start:${p.id}`,
        kind: 'project_start',
        date: p.start_date,
        title: `${p.name} starts`,
        subtitle: p.client_name,
        amountCents: null,
        link: `${base}/projects/${p.id}`,
        tone: 'neutral',
      });
    }
    if (p.end_date && p.end_date >= range.from && p.end_date <= range.to) {
      events.push({
        id: `project_end:${p.id}`,
        kind: 'project_end',
        date: p.end_date,
        title: `${p.name} ends`,
        subtitle: p.client_name,
        amountCents: null,
        link: `${base}/projects/${p.id}`,
        tone: 'neutral',
      });
    }
  }
  return events.sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.kind.localeCompare(b.kind) ||
      a.title.localeCompare(b.title),
  );
}

export async function calendarMonth(
  ctx: WorkspaceCtx,
  month?: string,
): Promise<{ month: string; events: CalendarEvent[] }> {
  const key = month ?? ctx.clock.today().slice(0, 7);
  const parsed = parseMonthKey(key);
  if (!parsed) throw fieldError('month', 'Month must be YYYY-MM');
  return { month: key, events: await calendarEvents(ctx, monthRange(parsed.year, parsed.month)) };
}
