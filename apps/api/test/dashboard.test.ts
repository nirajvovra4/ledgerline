import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createExpense,
  createFixture,
  createInvoice,
  createProject,
  type Fixture,
} from './helpers';

describe('dashboard', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const accounts = await accountsByKey(f);
    const client = await createClient(f, { name: 'Dash Co' });
    const project = await createProject(f, client.id, {
      hourlyRateCents: 10000,
      endDate: '2026-07-05',
    });
    await f.post('/time-entries', { projectId: project.id, date: '2026-06-29', minutes: 90 });
    const paid = await approvedInvoice(f, {
      clientId: client.id,
      issueDate: '2026-05-10',
      dueDate: '2026-06-09',
      lines: [{ description: 'May', quantity: 1, unitPriceCents: 40000 }],
    });
    await f.post(`/invoices/${paid.id}/payments`, {
      date: '2026-06-03',
      amountCents: 40000,
      method: 'bank_transfer',
    });
    await approvedInvoice(f, {
      clientId: client.id,
      issueDate: '2026-06-01',
      dueDate: '2026-06-15',
      lines: [{ description: 'June', quantity: 1, unitPriceCents: 25000 }],
    });
    await approvedInvoice(f, {
      clientId: client.id,
      issueDate: '2026-06-20',
      dueDate: '2026-07-04',
      lines: [{ description: 'Late June', quantity: 1, unitPriceCents: 5000 }],
    });
    await createInvoice(f, { clientId: client.id });
    const submitted = await createInvoice(f, { clientId: client.id });
    await f.post(`/invoices/${submitted.id}/submit`);
    const exp = await createExpense(f, {
      date: '2026-06-05',
      amountCents: 7000,
      accountId: accounts.travel_expense,
    });
    await f.post(`/expenses/${exp.id}/approve`, {});
    await f.post(`/expenses/${exp.id}/pay`, { date: '2026-06-12', method: 'card' });
  });
  afterAll(() => f.close());

  it('returns KPIs, cashflow, aging, top clients, recent items and upcoming events for the month', async () => {
    const res = await f.get('/dashboard');
    expect(res.status).toBe(200);
    const d = res.body;
    expect(d).toMatchObject({
      range: 'month',
      from: '2026-06-01',
      to: '2026-06-30',
      today: '2026-06-30',
      currency: 'GBP',
    });
    expect(d.kpis).toMatchObject({
      outstandingCents: 30000,
      overdueCents: 25000,
      overdueCount: 1,
      revenueCents: 30000,
      previousRevenueCents: 40000,
      expensesCents: 7000,
      previousExpensesCents: 0,
      netCents: 23000,
      unbilledMinutes: 90,
      unbilledCents: 15000,
      draftInvoiceCount: 1,
      pendingApprovalCount: 1,
    });
    expect(d.cashflow).toEqual([
      { label: 'Jun 26', from: '2026-06-01', to: '2026-06-30', inCents: 40000, outCents: 7000 },
    ]);
    expect(
      d.aging.map((b: { bucket: string; amountCents: number }) => [b.bucket, b.amountCents]),
    ).toEqual([
      ['current', 5000],
      ['d1_30', 25000],
      ['d31_60', 0],
      ['d61_90', 0],
      ['d90_plus', 0],
    ]);
    expect(d.topClients).toEqual([
      { clientId: expect.any(String), name: 'Dash Co', revenueCents: 30000, shareBp: 10000 },
    ]);
    expect(d.recentInvoices).toHaveLength(5);
    expect(d.recentActivity).toHaveLength(10);
    expect(d.recentActivity[0]).toMatchObject({
      actorName: 'Ada Owner',
      entityType: 'expense',
      action: 'paid',
    });
    expect(d.upcoming.map((e: { kind: string; date: string }) => [e.kind, e.date])).toEqual([
      ['invoice_due', '2026-07-04'],
      ['project_end', '2026-07-05'],
    ]);
  });

  it('supports quarter and year ranges with monthly cashflow buckets', async () => {
    const q = await f.get('/dashboard?range=quarter');
    expect(q.body).toMatchObject({ range: 'quarter', from: '2026-04-01', to: '2026-06-30' });
    expect(q.body.cashflow.map((b: { label: string }) => b.label)).toEqual([
      'Apr 26',
      'May 26',
      'Jun 26',
    ]);
    expect(q.body.kpis.revenueCents).toBe(70000);
    const y = await f.get('/dashboard?range=year');
    expect(y.body.cashflow).toHaveLength(12);
    expect(y.body.kpis.previousRevenueCents).toBe(0);
    const bad = await f.get('/dashboard?range=decade');
    expect(bad.body.range).toBe('month');
  });
});
