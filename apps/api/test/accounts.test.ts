import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  approvedInvoice,
  createClient,
  createFixture,
  type Fixture,
} from './helpers';

describe('chart of accounts', () => {
  let f: Fixture;
  let accounts: Record<string, string>;
  beforeAll(async () => {
    f = await createFixture();
    accounts = await accountsByKey(f);
  });
  afterAll(() => f.close());

  it('creates child accounts and builds a tree with rolled-up balances', async () => {
    const child = await f.post('/accounts', {
      code: '5110',
      name: 'Cloud hosting',
      type: 'expense',
      parentId: accounts.software_expense,
      description: 'Servers',
    });
    expect(child.status).toBe(201);
    expect(child.body.account).toMatchObject({
      code: '5110',
      parentId: accounts.software_expense,
      isSystem: false,
      systemKey: null,
      balanceCents: 0,
    });
    const list = await f.get('/accounts');
    const software = list.body.tree.find((n: { code: string }) => n.code === '5100');
    expect(software.children.map((c: { code: string }) => c.code)).toEqual(['5110']);
    expect(list.body.tree.map((n: { code: string }) => n.code)).toEqual(
      list.body.tree
        .map((n: { code: string }) => n.code)
        .slice()
        .sort(),
    );
  });

  it('validates codes, duplicates and parent type', async () => {
    expect((await f.post('/accounts', { code: '5110', name: 'Dup', type: 'expense' })).status).toBe(
      409,
    );
    expect((await f.post('/accounts', { code: 'AB', name: 'Bad', type: 'expense' })).status).toBe(
      400,
    );
    const wrongParent = await f.post('/accounts', {
      code: '5120',
      name: 'Wrong',
      type: 'expense',
      parentId: accounts.cash,
    });
    expect(wrongParent.status).toBe(400);
    expect(wrongParent.body.error.details[0].path).toBe('parentId');
  });

  it('protects system accounts and allows renaming', async () => {
    expect((await f.patch(`/accounts/${accounts.cash}`, { code: '1001' })).status).toBe(400);
    expect((await f.patch(`/accounts/${accounts.cash}`, { archived: true })).status).toBe(400);
    const ok = await f.patch(`/accounts/${accounts.cash}`, { name: 'Main current account' });
    expect(ok.status).toBe(200);
    expect(ok.body.account.name).toBe('Main current account');
  });

  it('archived accounts are hidden unless requested', async () => {
    const acc = await f.post('/accounts', { code: '5990', name: 'Old', type: 'expense' });
    await f.patch(`/accounts/${acc.body.account.id}`, { archived: true });
    expect(
      (await f.get('/accounts')).body.items.some((a: { code: string }) => a.code === '5990'),
    ).toBe(false);
    expect(
      (await f.get('/accounts?includeArchived=true')).body.items.some(
        (a: { code: string }) => a.code === '5990',
      ),
    ).toBe(true);
  });

  it('the register shows a running balance with opening and closing totals', async () => {
    const clientId = (await createClient(f)).id;
    const a = await approvedInvoice(f, {
      clientId,
      issueDate: '2026-05-01',
      dueDate: '2026-05-31',
      lines: [{ description: 'a', quantity: 1, unitPriceCents: 10000 }],
    });
    await f.post(`/invoices/${a.id}/payments`, {
      date: '2026-05-20',
      amountCents: 10000,
      method: 'cash',
    });
    const b = await approvedInvoice(f, {
      clientId,
      issueDate: '2026-06-01',
      dueDate: '2026-06-30',
      lines: [{ description: 'b', quantity: 1, unitPriceCents: 25000 }],
    });
    await f.post(`/invoices/${b.id}/payments`, {
      date: '2026-06-15',
      amountCents: 5000,
      method: 'cash',
    });

    const full = await f.get(`/accounts/${accounts.accounts_receivable}/register`);
    expect(full.status).toBe(200);
    expect(full.body.account.code).toBe('1200');
    expect(full.body.openingBalanceCents).toBe(0);
    expect(
      full.body.items.map((r: { runningBalanceCents: number }) => r.runningBalanceCents),
    ).toEqual([10000, 0, 25000, 20000]);
    expect(full.body.closingBalanceCents).toBe(20000);
    expect(full.body.total).toBe(4);
    expect(full.body.items[0]).toMatchObject({
      entryNumber: 1,
      sourceType: 'invoice',
      debitCents: 10000,
      creditCents: 0,
      date: '2026-05-01',
    });

    const june = await f.get(
      `/accounts/${accounts.accounts_receivable}/register?from=2026-06-01&to=2026-06-30`,
    );
    expect(june.body.openingBalanceCents).toBe(0);
    expect(june.body.items).toHaveLength(2);
    expect(june.body.closingBalanceCents).toBe(20000);
    const may = await f.get(
      `/accounts/${accounts.accounts_receivable}/register?to=2026-05-31&pageSize=1`,
    );
    expect(may.body.items).toHaveLength(1);
    expect(may.body.total).toBe(2);
    expect(may.body.closingBalanceCents).toBe(0);

    const cash = await f.get(`/accounts/${accounts.cash}/register`);
    expect(cash.body.closingBalanceCents).toBe(15000);
    const balances = (await f.get('/accounts')).body.items;
    expect(
      balances.find((x: { id: string }) => x.id === accounts.services_revenue).balanceCents,
    ).toBe(35000);
    expect(
      balances.find((x: { id: string }) => x.id === accounts.accounts_receivable).balanceCents,
    ).toBe(20000);
  });
});
