import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createExpense,
  createFixture,
  createProject,
  createTaxRate,
  type Fixture,
} from './helpers';

/**
 * One scenario, many reports. Amounts are chosen so every figure can be checked by hand:
 *  - capital 100,000 on 1 Jan
 *  - invoice A (Client A) 1 Mar: 50,000 + 20% tax = 60,000, paid 15 Mar
 *  - invoice B (Client B) 1 Jun: 30,000 no tax, due 10 Jun, unpaid (overdue 20 days)
 *  - invoice C (Client A) 1 Feb: 10,000 no tax, due 1 Mar, unpaid (overdue 121 days)
 *  - expense 10 Jun: 8,000 + 20% tax = 9,600, approved and paid 20 Jun
 *  - expense 5 May: 4,000 no tax, approved (unpaid)
 */
describe('reports', () => {
  let f: Fixture;
  let accounts: Record<string, string>;
  let clientA: string;
  let clientB: string;
  beforeAll(async () => {
    f = await createFixture();
    accounts = await accountsByKey(f);
    const taxRateId = (await createTaxRate(f, 2000)).id;
    clientA = (await createClient(f, { name: 'Client A' })).id;
    clientB = (await createClient(f, { name: 'Client B' })).id;
    await f.post('/journal', {
      date: '2026-01-01',
      memo: 'Capital',
      lines: [
        { accountId: accounts.cash, debitCents: 100000 },
        { accountId: accounts.owner_equity, creditCents: 100000 },
      ],
    });
    const a = await approvedInvoice(f, {
      clientId: clientA,
      issueDate: '2026-03-01',
      dueDate: '2026-03-31',
      lines: [{ description: 'A', quantity: 1, unitPriceCents: 50000, taxRateId }],
    });
    await f.post(`/invoices/${a.id}/payments`, {
      date: '2026-03-15',
      amountCents: 60000,
      method: 'bank_transfer',
    });
    await approvedInvoice(f, {
      clientId: clientB,
      issueDate: '2026-06-01',
      dueDate: '2026-06-10',
      lines: [{ description: 'B', quantity: 1, unitPriceCents: 30000 }],
    });
    await approvedInvoice(f, {
      clientId: clientA,
      issueDate: '2026-02-01',
      dueDate: '2026-03-01',
      lines: [{ description: 'C', quantity: 1, unitPriceCents: 10000 }],
    });
    const e1 = await createExpense(f, {
      date: '2026-06-10',
      amountCents: 8000,
      taxRateId,
      accountId: accounts.software_expense,
    });
    await f.post(`/expenses/${e1.id}/approve`, {});
    await f.post(`/expenses/${e1.id}/pay`, { date: '2026-06-20', method: 'card' });
    const e2 = await createExpense(f, {
      date: '2026-05-05',
      amountCents: 4000,
      accountId: accounts.travel_expense,
      vendor: 'LNER',
    });
    await f.post(`/expenses/${e2.id}/approve`, {});
  });
  afterAll(() => f.close());

  it('profit & loss nets revenue against expenses with a comparison period', async () => {
    const res = await f.get('/reports/profit-loss?from=2026-04-01&to=2026-06-30&compare=previous');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      from: '2026-04-01',
      to: '2026-06-30',
      compareFrom: '2026-01-01',
      compareTo: '2026-03-31',
    });
    expect(res.body.revenue.totalCents).toBe(30000);
    expect(res.body.revenue.previousTotalCents).toBe(60000);
    expect(res.body.expenses.totalCents).toBe(12000);
    expect(res.body.expenses.previousTotalCents).toBe(0);
    expect(res.body.netIncomeCents).toBe(18000);
    expect(res.body.previousNetIncomeCents).toBe(60000);
    expect(res.body.marginBp).toBe(6000);
    expect(
      res.body.expenses.lines.map((l: { code: string; amountCents: number }) => [
        l.code,
        l.amountCents,
      ]),
    ).toEqual([
      ['5100', 8000],
      ['5200', 4000],
    ]);
    const ytd = await f.get('/reports/profit-loss');
    expect(ytd.body).toMatchObject({
      from: '2026-01-01',
      to: '2026-06-30',
      compareFrom: null,
      netIncomeCents: 78000,
    });
  });

  it('balance sheet balances', async () => {
    const res = await f.get('/reports/balance-sheet');
    expect(res.status).toBe(200);
    expect(res.body.asOf).toBe('2026-06-30');
    const asset = (code: string) =>
      res.body.assets.lines.find((l: { code: string }) => l.code === code)?.amountCents;
    expect(asset('1000')).toBe(100000 + 60000 - 9600);
    expect(asset('1200')).toBe(40000);
    expect(asset('1300')).toBe(1600);
    expect(
      res.body.liabilities.lines.map((l: { code: string; amountCents: number }) => [
        l.code,
        l.amountCents,
      ]),
    ).toEqual([
      ['2000', 4000],
      ['2200', 10000],
    ]);
    expect(res.body.equity.totalCents).toBe(100000);
    expect(res.body.currentEarningsCents).toBe(78000);
    expect(res.body.totalAssetsCents).toBe(192000);
    expect(res.body.totalLiabilitiesAndEquityCents).toBe(192000);
    expect(res.body.balanced).toBe(true);
    const earlier = await f.get('/reports/balance-sheet?asOf=2026-01-31');
    expect(earlier.body.totalAssetsCents).toBe(100000);
    expect(earlier.body.balanced).toBe(true);
  });

  it('trial balance balances and lists only accounts with activity', async () => {
    const res = await f.get('/reports/trial-balance');
    expect(res.body.balanced).toBe(true);
    expect(res.body.totalDebitCents).toBe(res.body.totalCreditCents);
    expect(res.body.rows.map((r: { code: string }) => r.code)).toEqual([
      '1000',
      '1200',
      '1300',
      '2000',
      '2200',
      '3000',
      '4000',
      '5100',
      '5200',
    ]);
    expect(res.body.rows.find((r: { code: string }) => r.code === '4000')).toMatchObject({
      debitCents: 0,
      creditCents: 90000,
      type: 'revenue',
    });
  });

  it('AR aging buckets open balances by days overdue', async () => {
    const res = await f.get('/reports/ar-aging');
    expect(res.status).toBe(200);
    expect(res.body.totalCents).toBe(40000);
    const bucket = (key: string) =>
      res.body.buckets.find((b: { bucket: string }) => b.bucket === key);
    expect(bucket('d1_30')).toMatchObject({ amountCents: 30000, count: 1 });
    expect(bucket('d90_plus')).toMatchObject({ amountCents: 10000, count: 1 });
    expect(bucket('current')).toMatchObject({ amountCents: 0, count: 0 });
    expect(
      res.body.rows.map((r: { clientName: string; totalCents: number; oldestDays: number }) => [
        r.clientName,
        r.totalCents,
        r.oldestDays,
      ]),
    ).toEqual([
      ['Client B', 30000, 20],
      ['Client A', 10000, 121],
    ]);
    const asOf = await f.get('/reports/ar-aging?asOf=2026-06-05');
    expect(
      asOf.body.buckets.find((b: { bucket: string }) => b.bucket === 'current').amountCents,
    ).toBe(30000);
  });

  it('tax summary groups collected and paid tax by rate', async () => {
    const res = await f.get('/reports/tax-summary?from=2026-01-01&to=2026-06-30');
    expect(res.body.collectedCents).toBe(10000);
    expect(res.body.paidCents).toBe(1600);
    expect(res.body.netPayableCents).toBe(8400);
    expect(
      res.body.collected.map((r: { name: string; netCents: number; taxCents: number }) => [
        r.name,
        r.netCents,
        r.taxCents,
      ]),
    ).toEqual([
      ['Tax 20%', 50000, 10000],
      ['No tax', 40000, 0],
    ]);
    expect(res.body.paid).toEqual([
      {
        taxRateId: expect.any(String),
        name: 'Tax 20%',
        rateBp: 2000,
        netCents: 8000,
        taxCents: 1600,
      },
    ]);
  });

  it('revenue by client and time utilisation', async () => {
    const rev = await f.get('/reports/revenue-by-client?from=2026-01-01&to=2026-06-30');
    expect(rev.body.totalCents).toBe(100000);
    expect(
      rev.body.rows.map(
        (r: {
          clientName: string;
          invoicedCents: number;
          paidCents: number;
          outstandingCents: number;
          shareBp: number;
          invoiceCount: number;
        }) => [
          r.clientName,
          r.invoicedCents,
          r.paidCents,
          r.outstandingCents,
          r.shareBp,
          r.invoiceCount,
        ],
      ),
    ).toEqual([
      ['Client A', 70000, 60000, 10000, 7000, 2],
      ['Client B', 30000, 0, 30000, 3000, 1],
    ]);

    const project = await createProject(f, clientA, { hourlyRateCents: 6000 });
    await f.post('/time-entries', {
      projectId: project.id,
      date: '2026-06-01',
      minutes: 120,
      billable: true,
    });
    await f.post('/time-entries', {
      projectId: project.id,
      date: '2026-06-02',
      minutes: 60,
      billable: false,
    });
    const util = await f.get('/reports/time-utilisation?from=2026-06-01&to=2026-06-30');
    expect(util.body).toMatchObject({
      totalMinutes: 180,
      billableMinutes: 120,
      utilisationBp: 6667,
    });
    expect(util.body.rows[0]).toMatchObject({
      name: 'Ada Owner',
      minutes: 180,
      billableMinutes: 120,
      utilisationBp: 6667,
      billableValueCents: 12000,
    });
  });

  it('client statement runs a balance across invoices and payments', async () => {
    const res = await f.get(`/clients/${clientA}/statement?from=2026-03-01&to=2026-06-30`);
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Client A');
    expect(res.body.openingBalanceCents).toBe(10000);
    expect(
      res.body.rows.map(
        (r: { kind: string; debitCents: number; creditCents: number; balanceCents: number }) => [
          r.kind,
          r.debitCents,
          r.creditCents,
          r.balanceCents,
        ],
      ),
    ).toEqual([
      ['invoice', 60000, 0, 70000],
      ['payment', 0, 60000, 10000],
    ]);
    expect(res.body.closingBalanceCents).toBe(10000);
    const full = await f.get(`/clients/${clientA}/statement?from=2026-01-01`);
    expect(full.body.openingBalanceCents).toBe(0);
    expect(full.body.rows).toHaveLength(3);
  });
});
