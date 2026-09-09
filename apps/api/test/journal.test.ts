import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { accountsByKey, addMember, createFixture, type Fixture, type Session } from './helpers';

describe('journal', () => {
  let f: Fixture;
  let accounts: Record<string, string>;
  let accountant: Session;
  let entryId: string;
  beforeAll(async () => {
    f = await createFixture();
    accounts = await accountsByKey(f);
    accountant = await addMember(f.app, f.owner.cookie, f.slug, 'accountant');
  });
  afterAll(() => f.close());

  it('posts a balanced manual entry with sequential numbering', async () => {
    const res = await f.post(
      '/journal',
      {
        date: '2026-01-05',
        memo: 'Opening balance — owner capital',
        lines: [
          { accountId: accounts.cash, debitCents: 2500000, description: 'Capital' },
          { accountId: accounts.owner_equity, creditCents: 2500000, description: 'Capital' },
        ],
      },
      accountant.cookie,
    );
    expect(res.status).toBe(201);
    entryId = res.body.entry.id;
    expect(res.body.entry).toMatchObject({
      entryNumber: 1,
      sourceType: 'manual',
      memo: 'Opening balance — owner capital',
      postedByName: accountant.user.name,
      totalDebitCents: 2500000,
      totalCreditCents: 2500000,
      reversedEntryId: null,
    });
    expect(res.body.entry.lines[0]).toMatchObject({
      accountCode: '1000',
      debitCents: 2500000,
      creditCents: 0,
    });
    const second = await f.post('/journal', {
      date: '2026-02-01',
      memo: 'Bank interest',
      lines: [
        { accountId: accounts.cash, debitCents: 1250 },
        { accountId: accounts.other_income, creditCents: 1250 },
      ],
    });
    expect(second.body.entry.entryNumber).toBe(2);
  });

  it('rejects an unbalanced entry with 422 unbalanced_entry', async () => {
    const res = await f.post('/journal', {
      date: '2026-01-05',
      memo: 'Oops',
      lines: [
        { accountId: accounts.cash, debitCents: 100 },
        { accountId: accounts.owner_equity, creditCents: 90 },
      ],
    });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('unbalanced_entry');
    expect(res.body.error.details).toEqual({ debitCents: 100, creditCents: 90 });
  });

  it('validates the shape before the balance check', async () => {
    const oneLine = await f.post('/journal', {
      date: '2026-01-05',
      memo: 'x',
      lines: [{ accountId: accounts.cash, debitCents: 100 }],
    });
    expect(oneLine.status).toBe(400);
    const both = await f.post('/journal', {
      date: '2026-01-05',
      memo: 'x',
      lines: [
        { accountId: accounts.cash, debitCents: 100, creditCents: 100 },
        { accountId: accounts.owner_equity, creditCents: 0 },
      ],
    });
    expect(both.status).toBe(400);
    const unknownAccount = await f.post('/journal', {
      date: '2026-01-05',
      memo: 'x',
      lines: [
        { accountId: '00000000-0000-4000-8000-000000000000', debitCents: 100 },
        { accountId: accounts.owner_equity, creditCents: 100 },
      ],
    });
    expect(unknownAccount.status).toBe(400);
    expect(unknownAccount.body.error.details[0].path).toBe('lines.0.accountId');
  });

  it('lists with filters and fetches a single entry', async () => {
    const all = await f.get('/journal');
    expect(all.body.total).toBe(2);
    expect(all.body.items[0].entryNumber).toBe(2);
    expect(all.body.items[0].lines).toHaveLength(2);
    expect((await f.get('/journal?q=interest')).body.total).toBe(1);
    expect((await f.get(`/journal?accountId=${accounts.other_income}`)).body.total).toBe(1);
    expect((await f.get('/journal?from=2026-01-01&to=2026-01-31')).body.total).toBe(1);
    expect((await f.get('/journal?sourceType=invoice')).body.total).toBe(0);
    const one = await f.get(`/journal/${entryId}`);
    expect(one.status).toBe(200);
    expect(one.body.entry.id).toBe(entryId);
    expect((await f.get('/journal/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('reverses an entry with mirrored lines and refuses to reverse twice', async () => {
    const res = await f.post(`/journal/${entryId}/reverse`, {
      date: '2026-03-01',
      memo: 'Undo capital',
    });
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      sourceType: 'reversal',
      reversedEntryId: entryId,
      entryNumber: 3,
      date: '2026-03-01',
      memo: 'Undo capital',
    });
    expect(
      res.body.entry.lines.map(
        (l: { accountCode: string; debitCents: number; creditCents: number }) => [
          l.accountCode,
          l.debitCents,
          l.creditCents,
        ],
      ),
    ).toEqual([
      ['1000', 0, 2500000],
      ['3000', 2500000, 0],
    ]);
    expect((await f.post(`/journal/${entryId}/reverse`, {})).status).toBe(409);
    const cash = (await f.get('/accounts')).body.items.find(
      (a: { code: string }) => a.code === '1000',
    );
    expect(cash.balanceCents).toBe(1250);
    const defaults = await f.post(`/journal/${res.body.entry.id}/reverse`, {});
    expect(defaults.body.entry.date).toBe('2026-06-30');
    expect(defaults.body.entry.memo).toContain('Reversal of #3');
  });
});
