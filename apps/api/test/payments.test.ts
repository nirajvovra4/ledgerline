import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createFixture,
  type Fixture,
} from './helpers';

describe('payments', () => {
  let f: Fixture;
  let clientA: string;
  let clientB: string;
  let invoiceId: string;
  let paymentId: string;
  beforeAll(async () => {
    f = await createFixture();
    clientA = (await createClient(f, { name: 'A Ltd' })).id;
    clientB = (await createClient(f, { name: 'B Ltd' })).id;
    const a = await approvedInvoice(f, {
      clientId: clientA,
      lines: [{ description: 'x', quantity: 1, unitPriceCents: 100000 }],
    });
    invoiceId = a.id;
    const b = await approvedInvoice(f, {
      clientId: clientB,
      lines: [{ description: 'y', quantity: 1, unitPriceCents: 50000 }],
    });
    const p1 = await f.post(`/invoices/${a.id}/payments`, {
      date: '2026-06-05',
      amountCents: 60000,
      method: 'bank_transfer',
      reference: 'A-1',
    });
    paymentId = p1.body.payment.id;
    await f.post(`/invoices/${a.id}/payments`, {
      date: '2026-06-20',
      amountCents: 40000,
      method: 'card',
    });
    await f.post(`/invoices/${b.id}/payments`, {
      date: '2026-06-10',
      amountCents: 50000,
      method: 'cheque',
    });
  });
  afterAll(() => f.close());

  it('lists payments newest first with filters', async () => {
    const all = await f.get('/payments');
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((p: { date: string }) => p.date)).toEqual([
      '2026-06-20',
      '2026-06-10',
      '2026-06-05',
    ]);
    expect(all.body.items[0]).toMatchObject({
      clientName: 'A Ltd',
      method: 'card',
      amountCents: 40000,
    });
    expect((await f.get(`/payments?clientId=${clientB}`)).body.total).toBe(1);
    expect((await f.get('/payments?method=bank_transfer')).body.items[0].reference).toBe('A-1');
    expect((await f.get('/payments?from=2026-06-06&to=2026-06-30')).body.total).toBe(2);
    expect((await f.get('/payments?sort=amount&dir=asc')).body.items[0].amountCents).toBe(40000);
  });

  it('validates the payment body', async () => {
    const res = await f.post(`/invoices/${invoiceId}/payments`, {
      date: 'nope',
      amountCents: -5,
      method: 'bitcoin',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['date', 'amountCents', 'method']),
    );
  });

  it('deleting a payment reverses its journal entry and reopens the invoice', async () => {
    const accounts = await accountsByKey(f);
    const before = (await f.get('/accounts')).body.items.find(
      (a: { id: string }) => a.id === accounts.cash,
    ).balanceCents;
    expect(before).toBe(150000);
    const res = await f.del(`/payments/${paymentId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });

    const inv = (await f.get(`/invoices/${invoiceId}`)).body.invoice;
    expect(inv).toMatchObject({
      status: 'partially_paid',
      amountPaidCents: 40000,
      balanceCents: 60000,
    });
    expect(inv.payments).toHaveLength(1);
    const reversal = inv.journalEntries.find(
      (e: { sourceType: string }) => e.sourceType === 'reversal',
    );
    expect(reversal).toBeTruthy();
    expect(
      reversal.lines.find((l: { accountId: string }) => l.accountId === accounts.cash).creditCents,
    ).toBe(60000);
    const after = (await f.get('/accounts')).body.items.find(
      (a: { id: string }) => a.id === accounts.cash,
    ).balanceCents;
    expect(after).toBe(90000);
    expect((await f.get('/payments')).body.total).toBe(2);
    expect((await f.del(`/payments/${paymentId}`)).status).toBe(404);
  });

  it('deleting the last payment returns a partially paid invoice to sent', async () => {
    const inv = (await f.get(`/invoices/${invoiceId}`)).body.invoice;
    await f.del(`/payments/${inv.payments[0].id}`);
    const after = (await f.get(`/invoices/${invoiceId}`)).body.invoice;
    expect(after).toMatchObject({ status: 'sent', amountPaidCents: 0, balanceCents: 100000 });
  });
});
