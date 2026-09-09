import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createExpense,
  createFixture,
  createProject,
  type Fixture,
} from './helpers';

describe('calendar', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const accounts = await accountsByKey(f);
    const client = await createClient(f, { name: 'Cal Co' });
    await createProject(f, client.id, {
      name: 'Summer',
      startDate: '2026-06-08',
      endDate: '2026-06-26',
    });
    const inv = await approvedInvoice(f, {
      clientId: client.id,
      issueDate: '2026-06-02',
      dueDate: '2026-06-16',
      lines: [{ description: 'x', quantity: 1, unitPriceCents: 12000 }],
    });
    await f.post(`/invoices/${inv.id}/payments`, {
      date: '2026-06-12',
      amountCents: 2000,
      method: 'cash',
    });
    const e1 = await createExpense(f, {
      date: '2026-06-01',
      dueDate: '2026-06-20',
      amountCents: 3000,
      accountId: accounts.office_expense,
      vendor: 'Rymans',
    });
    await f.post(`/expenses/${e1.id}/approve`, {});
    const e2 = await createExpense(f, {
      date: '2026-06-03',
      amountCents: 4000,
      accountId: accounts.office_expense,
      vendor: 'Northern Gas',
    });
    await f.post(`/expenses/${e2.id}/approve`, {});
    await f.post(`/expenses/${e2.id}/pay`, { date: '2026-06-25', method: 'bank_transfer' });
  });
  afterAll(() => f.close());

  it('returns every event kind for the month, sorted by date', async () => {
    const res = await f.get('/calendar?month=2026-06');
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-06');
    const events = res.body.events;
    expect(events.map((e: { date: string; kind: string }) => [e.date, e.kind])).toEqual([
      ['2026-06-02', 'invoice_issued'],
      ['2026-06-08', 'project_start'],
      ['2026-06-12', 'payment_received'],
      ['2026-06-16', 'invoice_due'],
      ['2026-06-20', 'expense_due'],
      ['2026-06-25', 'expense_paid'],
      ['2026-06-26', 'project_end'],
    ]);
    const due = events.find((e: { kind: string }) => e.kind === 'invoice_due');
    expect(due).toMatchObject({
      tone: 'negative',
      amountCents: 10000,
      subtitle: expect.stringContaining('outstanding'),
    });
    expect(due.title).toContain('overdue');
    expect(due.link).toMatch(new RegExp(`^/w/${f.slug}/invoices/`));
    expect(events.find((e: { kind: string }) => e.kind === 'expense_due').tone).toBe('negative');
    expect(events.find((e: { kind: string }) => e.kind === 'payment_received')).toMatchObject({
      tone: 'positive',
      amountCents: 2000,
    });
    expect(events.find((e: { kind: string }) => e.kind === 'project_start').amountCents).toBeNull();
  });

  it('defaults to the current month and validates the format', async () => {
    const res = await f.get('/calendar');
    expect(res.body.month).toBe('2026-06');
    expect((await f.get('/calendar?month=2026-07')).body.events).toEqual([]);
    expect((await f.get('/calendar?month=June')).status).toBe(400);
  });
});
