import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  addMember,
  createClient,
  createFixture,
  createInvoice,
  createTaxRate,
  type Fixture,
  type Session,
} from './helpers';

describe('invoice lifecycle', () => {
  let f: Fixture;
  let member: Session;
  let accountant: Session;
  let clientId: string;
  let accounts: Record<string, string>;
  let taxRateId: string;
  let invoiceId: string;
  beforeAll(async () => {
    f = await createFixture();
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    accountant = await addMember(f.app, f.owner.cookie, f.slug, 'accountant');
    clientId = (await createClient(f, { name: 'Acme Corp' })).id;
    accounts = await accountsByKey(f);
    taxRateId = (await createTaxRate(f, 2000)).id;
  });
  afterAll(() => f.close());

  it('member creates a draft and submits it; approvers are notified', async () => {
    const inv = await createInvoice(f, {
      clientId,
      cookie: member.cookie,
      issueDate: '2026-06-10',
      dueDate: '2026-06-20',
      lines: [
        { description: 'Design', quantity: 10, unitPriceCents: 10000, taxRateId },
        {
          description: 'Print',
          quantity: 1,
          unitPriceCents: 20000,
          taxRateId: null,
          accountId: accounts.product_revenue,
        },
      ],
    });
    invoiceId = inv.id;
    expect(inv.totalCents).toBe(100000 + 20000 + 20000);
    const submit = await f.post(`/invoices/${inv.id}/submit`, {}, member.cookie);
    expect(submit.status).toBe(200);
    expect(submit.body.invoice.status).toBe('pending_approval');
    expect(submit.body.invoice.approvals).toHaveLength(1);
    expect(submit.body.invoice.approvals[0]).toMatchObject({
      status: 'pending',
      requestedByName: member.user.name,
      subjectLabel: inv.number,
      subjectCounterparty: 'Acme Corp',
      subjectAmountCents: 140000,
    });

    const ownerNotes = await f.get('/notifications?unread=true');
    expect(ownerNotes.body.unreadCount).toBeGreaterThan(0);
    expect(ownerNotes.body.items[0]).toMatchObject({
      kind: 'approval_requested',
      link: `/w/${f.slug}/invoices/${inv.id}`,
    });
    const acctNotes = await f.get('/notifications?unread=true', accountant.cookie);
    expect(
      acctNotes.body.items.some((n: { kind: string }) => n.kind === 'approval_requested'),
    ).toBe(true);
    const memberNotes = await f.get('/notifications', member.cookie);
    expect(
      memberNotes.body.items.some((n: { kind: string }) => n.kind === 'approval_requested'),
    ).toBe(false);

    const queue = await f.get('/approvals');
    expect(queue.body.items.map((a: { subjectId: string }) => a.subjectId)).toContain(inv.id);
    expect((await f.post(`/invoices/${inv.id}/submit`, {}, member.cookie)).status).toBe(409);
  });

  it('member cannot approve; accountant approval posts a balanced journal entry', async () => {
    expect((await f.post(`/invoices/${invoiceId}/approve`, {}, member.cookie)).status).toBe(403);
    const res = await f.post(
      `/invoices/${invoiceId}/approve`,
      { comment: 'Looks right' },
      accountant.cookie,
    );
    expect(res.status).toBe(200);
    const inv = res.body.invoice;
    expect(inv.status).toBe('approved');
    expect(inv.approvedBy).toBe(accountant.user.id);
    expect(inv.approvedAt).toBe('2026-06-30T12:00:00.000Z');
    expect(inv.approvals[0]).toMatchObject({
      status: 'approved',
      decidedByName: accountant.user.name,
      comment: 'Looks right',
    });
    expect(inv.journalEntries).toHaveLength(1);
    const entry = inv.journalEntries[0];
    expect(entry).toMatchObject({
      sourceType: 'invoice',
      sourceId: invoiceId,
      entryNumber: 1,
      date: '2026-06-10',
      totalDebitCents: 140000,
      totalCreditCents: 140000,
    });
    const byAccount = Object.fromEntries(
      entry.lines.map((l: { accountId: string; debitCents: number; creditCents: number }) => [
        l.accountId,
        [l.debitCents, l.creditCents],
      ]),
    );
    expect(byAccount[accounts.accounts_receivable]).toEqual([140000, 0]);
    expect(byAccount[accounts.services_revenue]).toEqual([0, 100000]);
    expect(byAccount[accounts.product_revenue]).toEqual([0, 20000]);
    expect(byAccount[accounts.sales_tax_payable]).toEqual([0, 20000]);
    expect(
      entry.lines.find((l: { accountId: string }) => l.accountId === accounts.accounts_receivable)
        .accountCode,
    ).toBe('1200');

    const memberNotes = await f.get('/notifications?unread=true', member.cookie);
    expect(memberNotes.body.items[0]).toMatchObject({ kind: 'approval_decided' });
    expect(memberNotes.body.items[0].title).toContain('approved');
    expect((await f.get('/approvals')).body.items).toHaveLength(0);
    expect((await f.get('/approvals?status=approved')).body.items).toHaveLength(1);
  });

  it('sending notifies the creator; partial and final payments update status', async () => {
    const send = await f.post(`/invoices/${invoiceId}/send`, {}, accountant.cookie);
    expect(send.status).toBe(200);
    expect(send.body.invoice.status).toBe('sent');
    expect(send.body.invoice.sentAt).toBeTruthy();
    expect(send.body.invoice.derivedStatus).toBe('overdue');
    const memberNotes = await f.get('/notifications', member.cookie);
    expect(memberNotes.body.items.some((n: { kind: string }) => n.kind === 'invoice_sent')).toBe(
      true,
    );
    expect((await f.post(`/invoices/${invoiceId}/send`, {}, accountant.cookie)).status).toBe(409);

    const over = await f.post(
      `/invoices/${invoiceId}/payments`,
      { date: '2026-06-25', amountCents: 140001, method: 'bank_transfer' },
      accountant.cookie,
    );
    expect(over.status).toBe(400);
    expect(over.body.error.code).toBe('validation_error');
    expect(over.body.error.details[0].path).toBe('amountCents');

    const partial = await f.post(
      `/invoices/${invoiceId}/payments`,
      { date: '2026-06-25', amountCents: 40000, method: 'bank_transfer', reference: 'TRF-1' },
      accountant.cookie,
    );
    expect(partial.status).toBe(201);
    expect(partial.body.payment).toMatchObject({
      amountCents: 40000,
      invoiceNumber: partial.body.invoice.number,
      clientName: 'Acme Corp',
      reference: 'TRF-1',
    });
    expect(partial.body.payment.journalEntryId).toBeTruthy();
    expect(partial.body.invoice).toMatchObject({
      status: 'partially_paid',
      amountPaidCents: 40000,
      balanceCents: 100000,
      derivedStatus: 'overdue',
    });
    expect(partial.body.invoice.journalEntries).toHaveLength(2);
    const paymentEntry = partial.body.invoice.journalEntries[1];
    expect(paymentEntry.sourceType).toBe('payment');
    expect(
      paymentEntry.lines.find((l: { accountId: string }) => l.accountId === accounts.cash)
        .debitCents,
    ).toBe(40000);
    expect(
      paymentEntry.lines.find(
        (l: { accountId: string }) => l.accountId === accounts.accounts_receivable,
      ).creditCents,
    ).toBe(40000);

    const ownerNotes = await f.get('/notifications?unread=true');
    expect(ownerNotes.body.items[0]).toMatchObject({ kind: 'payment_received' });

    const final = await f.post(`/invoices/${invoiceId}/payments`, {
      date: '2026-06-28',
      amountCents: 100000,
      method: 'card',
    });
    expect(final.status).toBe(201);
    expect(final.body.invoice).toMatchObject({
      status: 'paid',
      amountPaidCents: 140000,
      balanceCents: 0,
      derivedStatus: 'paid',
    });
    expect(final.body.invoice.payments).toHaveLength(2);
    expect(final.body.invoice.history.map((h: { action: string }) => h.action)).toEqual([
      'created',
      'submitted',
      'approved',
      'sent',
      'payment_recorded',
      'paid',
    ]);

    const more = await f.post(`/invoices/${invoiceId}/payments`, {
      date: '2026-06-29',
      amountCents: 1,
      method: 'cash',
    });
    expect(more.status).toBe(409);
  });

  it('rejecting returns the invoice to draft with the comment recorded', async () => {
    const inv = await createInvoice(f, { clientId, cookie: member.cookie });
    await f.post(`/invoices/${inv.id}/submit`, {}, member.cookie);
    const missing = await f.post(`/invoices/${inv.id}/reject`, {});
    expect(missing.status).toBe(400);
    const res = await f.post(
      `/invoices/${inv.id}/reject`,
      { comment: 'Wrong PO' },
      accountant.cookie,
    );
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('draft');
    expect(res.body.invoice.approvals[0]).toMatchObject({
      status: 'rejected',
      comment: 'Wrong PO',
    });
    expect(res.body.invoice.journalEntries).toHaveLength(0);
    const notes = await f.get('/notifications?unread=true', member.cookie);
    expect(notes.body.items[0].title).toContain('sent back');
    // Resubmit and approve straight away.
    await f.post(`/invoices/${inv.id}/submit`, {}, member.cookie);
    const approved = await f.post(`/invoices/${inv.id}/approve`, {});
    expect(approved.body.invoice.approvals).toHaveLength(2);
  });

  it('approve works directly from draft when approval is not required', async () => {
    await f.patch('/', { settings: { requireInvoiceApproval: false } });
    const inv = await createInvoice(f, { clientId });
    const res = await f.post(`/invoices/${inv.id}/approve`, {});
    expect(res.status).toBe(200);
    expect(res.body.invoice.status).toBe('approved');
    expect(res.body.invoice.journalEntries).toHaveLength(1);
    expect(res.body.invoice.approvals[0]).toMatchObject({
      status: 'approved',
      requestedBy: f.owner.user.id,
    });
    // Payment can be recorded against an approved (unsent) invoice.
    const pay = await f.post(`/invoices/${inv.id}/payments`, {
      date: '2026-06-30',
      amountCents: inv.totalCents,
      method: 'cash',
    });
    expect(pay.body.invoice.status).toBe('paid');
  });
});
