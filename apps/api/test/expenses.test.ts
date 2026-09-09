import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  addMember,
  createExpense,
  createFixture,
  createTaxRate,
  type Fixture,
  type Session,
} from './helpers';

describe('expenses', () => {
  let f: Fixture;
  let member: Session;
  let accounts: Record<string, string>;
  let taxRateId: string;
  let expenseId: string;
  beforeAll(async () => {
    f = await createFixture();
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    accounts = await accountsByKey(f);
    taxRateId = (await createTaxRate(f, 2000)).id;
  });
  afterAll(() => f.close());

  it('creates a draft with tax computed from the rate', async () => {
    const detail = await createExpense(
      f,
      {
        amountCents: 25000,
        taxRateId,
        vendor: 'Adobe',
        description: 'Creative Cloud',
        dueDate: '2026-07-10',
      },
      member.cookie,
    );
    expenseId = detail.id;
    expect(detail).toMatchObject({
      status: 'draft',
      amountCents: 25000,
      taxRateBp: 2000,
      taxCents: 5000,
      totalCents: 30000,
      accountName: 'Software & Subscriptions',
      createdByName: member.user.name,
      dueDate: '2026-07-10',
      billable: false,
    });
    const full = await f.get(`/expenses/${detail.id}`);
    expect(full.body).toMatchObject({
      expense: { id: detail.id },
      approvals: [],
      journalEntries: [],
    });
    expect(full.body.history.map((h: { action: string }) => h.action)).toEqual(['created']);
  });

  it('validates account type, billable client and references', async () => {
    const bad = await f.post('/expenses', {
      vendor: 'X',
      description: 'Y',
      date: '2026-06-01',
      accountId: accounts.cash,
      amountCents: 100,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].path).toBe('accountId');
    const billable = await f.post('/expenses', {
      vendor: 'X',
      description: 'Y',
      date: '2026-06-01',
      accountId: accounts.travel_expense,
      amountCents: 100,
      billable: true,
    });
    expect(billable.status).toBe(400);
    expect(billable.body.error.details[0].path).toBe('clientId');
    expect(
      (
        await f.post('/expenses', {
          vendor: 'X',
          description: 'Y',
          date: '2026-06-01',
          accountId: accounts.travel_expense,
          amountCents: 0,
        })
      ).status,
    ).toBe(400);
  });

  it('submit → approve posts Dr expense + Dr input tax / Cr AP', async () => {
    const submit = await f.post(`/expenses/${expenseId}/submit`, {}, member.cookie);
    expect(submit.status).toBe(200);
    expect(submit.body.expense.status).toBe('pending_approval');
    expect(submit.body.approvals[0]).toMatchObject({
      status: 'pending',
      subjectType: 'expense',
      subjectCounterparty: 'Adobe',
      subjectAmountCents: 30000,
    });
    expect((await f.get('/notifications?unread=true')).body.items[0].kind).toBe(
      'approval_requested',
    );
    expect((await f.post(`/expenses/${expenseId}/approve`, {}, member.cookie)).status).toBe(403);
    expect((await f.patch(`/expenses/${expenseId}`, { vendor: 'Nope' })).status).toBe(409);

    const approve = await f.post(`/expenses/${expenseId}/approve`, { comment: 'ok' });
    expect(approve.status).toBe(200);
    expect(approve.body.expense.status).toBe('approved');
    expect(approve.body.journalEntries).toHaveLength(1);
    const entry = approve.body.journalEntries[0];
    expect(entry).toMatchObject({
      sourceType: 'expense',
      date: '2026-06-10',
      totalDebitCents: 30000,
      totalCreditCents: 30000,
    });
    const by = Object.fromEntries(
      entry.lines.map((l: { accountId: string; debitCents: number; creditCents: number }) => [
        l.accountId,
        [l.debitCents, l.creditCents],
      ]),
    );
    expect(by[accounts.software_expense]).toEqual([25000, 0]);
    expect(by[accounts.input_tax]).toEqual([5000, 0]);
    expect(by[accounts.accounts_payable]).toEqual([0, 30000]);
    expect((await f.get('/notifications?unread=true', member.cookie)).body.items[0].kind).toBe(
      'approval_decided',
    );
  });

  it('pay posts Dr AP / Cr cash and records the payment details', async () => {
    const res = await f.post(`/expenses/${expenseId}/pay`, {
      date: '2026-06-25',
      method: 'card',
      reference: 'CARD-9',
    });
    expect(res.status).toBe(200);
    expect(res.body.expense).toMatchObject({
      status: 'paid',
      paidAt: '2026-06-25',
      paymentMethod: 'card',
      reference: 'CARD-9',
    });
    expect(res.body.journalEntries).toHaveLength(2);
    const entry = res.body.journalEntries[1];
    expect(entry.sourceType).toBe('expense_payment');
    expect(
      entry.lines.find((l: { accountId: string }) => l.accountId === accounts.accounts_payable)
        .debitCents,
    ).toBe(30000);
    expect(
      entry.lines.find((l: { accountId: string }) => l.accountId === accounts.cash).creditCents,
    ).toBe(30000);
    expect(res.body.history.map((h: { action: string }) => h.action)).toEqual([
      'created',
      'submitted',
      'approved',
      'paid',
    ]);
    expect(
      (await f.post(`/expenses/${expenseId}/pay`, { date: '2026-06-26', method: 'cash' })).status,
    ).toBe(409);
    const ap = (await f.get('/accounts')).body.items.find(
      (a: { id: string }) => a.id === accounts.accounts_payable,
    );
    expect(ap.balanceCents).toBe(0);
  });

  it('rejected expenses can be edited and resubmitted; drafts can be deleted', async () => {
    const exp = await createExpense(
      f,
      {
        vendor: 'LNER',
        description: 'Train',
        amountCents: 6400,
        accountId: accounts.travel_expense,
      },
      member.cookie,
    );
    await f.post(`/expenses/${exp.id}/submit`, {}, member.cookie);
    const rejected = await f.post(`/expenses/${exp.id}/reject`, { comment: 'No receipt' });
    expect(rejected.body.expense.status).toBe('rejected');
    expect(rejected.body.approvals[0]).toMatchObject({ status: 'rejected', comment: 'No receipt' });
    const edit = await f.patch(
      `/expenses/${exp.id}`,
      { amountCents: 6000, notes: 'Receipt attached' },
      member.cookie,
    );
    expect(edit.status).toBe(200);
    expect(edit.body.expense).toMatchObject({
      amountCents: 6000,
      totalCents: 6000,
      notes: 'Receipt attached',
    });
    expect((await f.del(`/expenses/${exp.id}`, member.cookie)).status).toBe(409);
    const resubmit = await f.post(`/expenses/${exp.id}/submit`, {}, member.cookie);
    expect(resubmit.body.expense.status).toBe('pending_approval');
    expect(resubmit.body.approvals).toHaveLength(2);

    const draft = await createExpense(f, {}, member.cookie);
    expect((await f.del(`/expenses/${draft.id}`, f.owner.cookie)).status).toBe(200);
    expect((await f.get(`/expenses/${draft.id}`)).status).toBe(404);
  });

  it('members cannot edit other people’s drafts; approvers can approve straight from draft', async () => {
    const mine = await createExpense(f, { vendor: 'Owner draft' });
    expect(
      (await f.patch(`/expenses/${mine.id}`, { vendor: 'Hijack' }, member.cookie)).status,
    ).toBe(403);
    expect((await f.del(`/expenses/${mine.id}`, member.cookie)).status).toBe(403);
    const approve = await f.post(`/expenses/${mine.id}/approve`, {});
    expect(approve.status).toBe(200);
    expect(approve.body.expense.status).toBe('approved');
    expect(approve.body.approvals[0].status).toBe('approved');
  });

  it('lists with status filters and a summary', async () => {
    const all = await f.get('/expenses');
    expect(all.body.total).toBe(3);
    expect(all.body.summary).toMatchObject({ count: 3, unpaidCents: 10000, pendingCents: 6000 });
    expect(all.body.summary.totalCents).toBe(30000 + 6000 + 10000);
    expect((await f.get('/expenses?status=paid')).body.total).toBe(1);
    expect((await f.get('/expenses?status=unpaid')).body.items[0].vendor).toBe('Owner draft');
    expect((await f.get('/expenses?q=lner')).body.total).toBe(1);
    expect((await f.get(`/expenses?accountId=${accounts.travel_expense}`)).body.total).toBe(1);
    expect((await f.get('/expenses?sort=vendor&dir=asc')).body.items[0].vendor).toBe('Adobe');
  });
});
