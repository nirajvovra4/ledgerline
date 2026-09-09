import { computeInvoiceTotals } from '@ledgerline/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  createClient,
  createFixture,
  createInvoice,
  createTaxRate,
  type Fixture,
} from './helpers';

describe('invoice creation and editing', () => {
  let f: Fixture;
  let clientId: string;
  let taxRateId: string;
  let accounts: Record<string, string>;
  beforeAll(async () => {
    f = await createFixture();
    clientId = (await createClient(f, { name: 'Acme' })).id;
    taxRateId = (await createTaxRate(f, 2000)).id;
    accounts = await accountsByKey(f);
  });
  afterAll(() => f.close());

  it('assigns sequential numbers from workspace settings', async () => {
    await f.patch('/', {
      settings: { invoicePrefix: 'NL', nextInvoiceNumber: 1042, invoiceNumberPadding: 4 },
    });
    const a = await createInvoice(f, { clientId });
    const b = await createInvoice(f, { clientId });
    expect(a.number).toBe('NL-1042');
    expect(b.number).toBe('NL-1043');
    expect((await f.get('/')).body.workspace.settings.nextInvoiceNumber).toBe(1044);
    expect(a.status).toBe('draft');
    expect(a.currency).toBe('GBP');
    expect(a.clientName).toBe('Acme');
  });

  it('computes subtotal, discount, tax and total server-side and ignores client totals', async () => {
    const lines = [
      { description: 'Design', quantity: 12.5, unitPriceCents: 12000, taxRateId },
      { description: 'Print', quantity: 3, unitPriceCents: 4550, taxRateId: null },
      { description: 'Hosting', quantity: 1, unitPriceCents: 9999, taxRateId },
    ];
    const res = await f.post('/invoices', {
      clientId,
      issueDate: '2026-06-01',
      dueDate: '2026-07-01',
      discountBp: 1000,
      totalCents: 1,
      subtotalCents: 1,
      lines: lines.map((l) => ({ ...l, accountId: accounts.services_revenue, lineTotalCents: 1 })),
    });
    expect(res.status).toBe(201);
    const expected = computeInvoiceTotals(
      lines.map((l) => ({
        quantity: l.quantity,
        unitPriceCents: l.unitPriceCents,
        taxRateBp: l.taxRateId ? 2000 : 0,
      })),
      1000,
    );
    const inv = res.body.invoice;
    expect(inv.subtotalCents).toBe(150000 + 13650 + 9999);
    expect(inv.discountCents).toBe(expected.discountCents);
    expect(inv.taxCents).toBe(expected.taxCents);
    expect(inv.totalCents).toBe(expected.totalCents);
    expect(inv.totalCents).toBe(inv.subtotalCents - inv.discountCents + inv.taxCents);
    expect(inv.balanceCents).toBe(inv.totalCents);
    expect(inv.lines).toHaveLength(3);
    expect(inv.lines[0]).toMatchObject({
      position: 0,
      taxRateBp: 2000,
      lineTotalCents: expected.lines[0]?.lineTotalCents,
      taxCents: expected.lines[0]?.taxCents,
    });
    expect(inv.lines[1]).toMatchObject({ taxRateBp: 0, taxCents: 0 });
    expect(
      inv.lines.reduce((s: number, l: { lineTotalCents: number }) => s + l.lineTotalCents, 0),
    ).toBe(inv.subtotalCents - inv.discountCents);
    expect(inv.derivedStatus).toBe('draft');
    expect(inv.history.map((h: { action: string }) => h.action)).toEqual(['created']);
  });

  it('validates references: unknown client, non-revenue account, unknown tax rate, dates', async () => {
    const base = { clientId, issueDate: '2026-06-01', dueDate: '2026-07-01' };
    const badClient = await f.post('/invoices', {
      ...base,
      clientId: '00000000-0000-4000-8000-000000000000',
      lines: [
        { description: 'x', quantity: 1, unitPriceCents: 1, accountId: accounts.services_revenue },
      ],
    });
    expect(badClient.status).toBe(400);
    expect(badClient.body.error.details[0].path).toBe('clientId');
    const badAccount = await f.post('/invoices', {
      ...base,
      lines: [{ description: 'x', quantity: 1, unitPriceCents: 1, accountId: accounts.cash }],
    });
    expect(badAccount.status).toBe(400);
    expect(badAccount.body.error.details[0].path).toBe('lines.0.accountId');
    const badTax = await f.post('/invoices', {
      ...base,
      lines: [
        {
          description: 'x',
          quantity: 1,
          unitPriceCents: 1,
          accountId: accounts.services_revenue,
          taxRateId: '00000000-0000-4000-8000-000000000000',
        },
      ],
    });
    expect(badTax.status).toBe(400);
    const badDates = await f.post('/invoices', {
      ...base,
      dueDate: '2026-05-01',
      lines: [
        { description: 'x', quantity: 1, unitPriceCents: 1, accountId: accounts.services_revenue },
      ],
    });
    expect(badDates.status).toBe(400);
    const noLines = await f.post('/invoices', { ...base, lines: [] });
    expect(noLines.status).toBe(400);
  });

  it('rejects a duplicate invoice number with 409 when the sequence collides', async () => {
    await f.patch('/', { settings: { nextInvoiceNumber: 1042 } });
    const res = await f.post('/invoices', {
      clientId,
      issueDate: '2026-06-01',
      dueDate: '2026-07-01',
      lines: [
        {
          description: 'x',
          quantity: 1,
          unitPriceCents: 100,
          accountId: accounts.services_revenue,
        },
      ],
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
    await f.patch('/', { settings: { nextInvoiceNumber: 2000 } });
  });

  it('editing a draft replaces lines and recomputes totals; non-drafts are locked', async () => {
    const inv = await createInvoice(f, { clientId });
    const res = await f.patch(`/invoices/${inv.id}`, {
      clientId,
      issueDate: '2026-06-05',
      dueDate: '2026-07-05',
      discountBp: 0,
      poNumber: 'PO-77',
      lines: [
        {
          id: inv.lines[0].id,
          description: 'Kept line',
          quantity: 2,
          unitPriceCents: 1000,
          accountId: accounts.services_revenue,
        },
        {
          description: 'New line',
          quantity: 1,
          unitPriceCents: 500,
          accountId: accounts.product_revenue,
          taxRateId,
        },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.invoice).toMatchObject({
      number: inv.number,
      poNumber: 'PO-77',
      subtotalCents: 2500,
      taxCents: 100,
      totalCents: 2600,
      issueDate: '2026-06-05',
    });
    expect(res.body.invoice.lines.map((l: { id: string }) => l.id)).toContain(inv.lines[0].id);
    expect(res.body.invoice.lines).toHaveLength(2);

    await f.post(`/invoices/${inv.id}/submit`);
    const locked = await f.patch(`/invoices/${inv.id}`, {
      clientId,
      issueDate: '2026-06-05',
      dueDate: '2026-07-05',
      lines: [
        { description: 'x', quantity: 1, unitPriceCents: 1, accountId: accounts.services_revenue },
      ],
    });
    expect(locked.status).toBe(409);
    expect(locked.body.error.code).toBe('invalid_transition');
  });

  it('deletes drafts only', async () => {
    const draft = await createInvoice(f, { clientId });
    expect((await f.del(`/invoices/${draft.id}`)).status).toBe(200);
    expect((await f.get(`/invoices/${draft.id}`)).status).toBe(404);
    const submitted = await createInvoice(f, { clientId });
    await f.post(`/invoices/${submitted.id}/submit`);
    const res = await f.del(`/invoices/${submitted.id}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('invalid_transition');
  });

  it('lists with status filters, summary and search', async () => {
    const list = await f.get('/invoices');
    expect(list.status).toBe(200);
    expect(list.body.summary).toMatchObject({ count: list.body.total });
    expect(
      list.body.items[0].issueDate >= list.body.items[list.body.items.length - 1].issueDate,
    ).toBe(true);
    const pending = await f.get('/invoices?status=pending_approval');
    expect(
      pending.body.items.every((i: { status: string }) => i.status === 'pending_approval'),
    ).toBe(true);
    expect(pending.body.total).toBeGreaterThan(0);
    const search = await f.get('/invoices?q=NL-1043');
    expect(search.body.items.map((i: { number: string }) => i.number)).toEqual(['NL-1043']);
    const byClient = await f.get('/invoices?q=acme');
    expect(byClient.body.total).toBe(list.body.total);
    const range = await f.get('/invoices?from=2026-06-05&to=2026-06-05');
    expect(range.body.items.every((i: { issueDate: string }) => i.issueDate === '2026-06-05')).toBe(
      true,
    );
  });
});
