import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createFixture,
  createInvoice,
  type Fixture,
} from './helpers';

describe('voiding invoices', () => {
  let f: Fixture;
  let clientId: string;
  let accounts: Record<string, string>;
  beforeAll(async () => {
    f = await createFixture();
    clientId = (await createClient(f)).id;
    accounts = await accountsByKey(f);
  });
  afterAll(() => f.close());

  it('voiding a sent invoice creates a reversal of the approval entry', async () => {
    const inv = await approvedInvoice(f, {
      clientId,
      lines: [{ description: 'Work', quantity: 1, unitPriceCents: 30000 }],
    });
    const res = await f.post(`/invoices/${inv.id}/void`, { reason: 'Issued in error' });
    expect(res.status).toBe(200);
    expect(res.body.invoice).toMatchObject({
      status: 'void',
      voidReason: 'Issued in error',
      derivedStatus: 'void',
    });
    expect(res.body.invoice.voidedAt).toBeTruthy();
    expect(res.body.invoice.journalEntries).toHaveLength(2);
    const [original, reversal] = res.body.invoice.journalEntries;
    expect(reversal).toMatchObject({
      sourceType: 'reversal',
      reversedEntryId: original.id,
      date: '2026-06-30',
    });
    const ar = reversal.lines.find(
      (l: { accountId: string }) => l.accountId === accounts.accounts_receivable,
    );
    expect(ar).toMatchObject({ debitCents: 0, creditCents: 30000 });
    const rev = reversal.lines.find(
      (l: { accountId: string }) => l.accountId === accounts.services_revenue,
    );
    expect(rev).toMatchObject({ debitCents: 30000, creditCents: 0 });

    const arAccount = (await f.get('/accounts')).body.items.find(
      (a: { id: string }) => a.id === accounts.accounts_receivable,
    );
    expect(arAccount.balanceCents).toBe(0);
    expect((await f.post(`/invoices/${inv.id}/void`, { reason: 'again' })).status).toBe(409);
  });

  it('voiding a draft does not touch the ledger', async () => {
    const inv = await createInvoice(f, { clientId });
    const res = await f.post(`/invoices/${inv.id}/void`, { reason: 'Never needed' });
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('void');
    expect(res.body.invoice.journalEntries).toHaveLength(0);
  });

  it('a paid invoice cannot be voided', async () => {
    const inv = await approvedInvoice(f, {
      clientId,
      lines: [{ description: 'Work', quantity: 1, unitPriceCents: 5000 }],
    });
    await f.post(`/invoices/${inv.id}/payments`, {
      date: '2026-06-30',
      amountCents: 5000,
      method: 'cash',
    });
    const res = await f.post(`/invoices/${inv.id}/void`, { reason: 'Too late' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('invalid_transition');
    expect(res.body.error.message).toContain('paid');
  });

  it('requires a reason', async () => {
    const inv = await createInvoice(f, { clientId });
    const res = await f.post(`/invoices/${inv.id}/void`, {});
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].path).toBe('reason');
  });

  it('shows void invoices in the list with a void filter and excludes them from totals', async () => {
    const list = await f.get('/invoices?status=void');
    expect(list.body.total).toBe(2);
    expect(list.body.summary.totalCents).toBe(0);
    const all = await f.get('/invoices?status=all');
    // The paid 5,000 invoice plus the untouched 120,000 draft from the reason test; voids excluded.
    expect(all.body.summary.totalCents).toBe(125000);
  });
});
