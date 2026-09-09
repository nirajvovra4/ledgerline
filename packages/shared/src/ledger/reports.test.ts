import { describe, expect, it } from 'vitest';
import type { AccountDto, AccountType } from '../types';
import {
  accountBalance,
  buildAccountTree,
  buildBalanceSheet,
  buildProfitAndLoss,
  buildTrialBalance,
  flattenTree,
  type LedgerLineLike,
  naturalBalance,
  totalsByAccount,
} from './reports';

const acct = (id: string, code: string, name: string, type: AccountType, parentId: string | null = null) => ({ id, code, name, type, parentId });

const ACCOUNTS = [
  acct('cash', '1000', 'Operating Bank Account', 'asset'),
  acct('ar', '1200', 'Accounts Receivable', 'asset'),
  acct('tax', '2200', 'Sales Tax Payable', 'liability'),
  acct('equity', '3000', "Owner's Equity", 'equity'),
  acct('services', '4000', 'Services Revenue', 'revenue'),
  acct('product', '4100', 'Product Revenue', 'revenue'),
  acct('software', '5100', 'Software & Subscriptions', 'expense'),
  acct('travel', '5200', 'Travel', 'expense'),
  acct('other', '5900', 'Other Expenses', 'expense'),
];

const dr = (accountId: string, date: string, cents: number): LedgerLineLike => ({ accountId, date, debitCents: cents, creditCents: 0 });
const cr = (accountId: string, date: string, cents: number): LedgerLineLike => ({ accountId, date, debitCents: 0, creditCents: cents });

/** A small, balanced journal spanning Q1 2024. */
const LINES: LedgerLineLike[] = [
  // owner invests
  dr('cash', '2024-01-05', 100000),
  cr('equity', '2024-01-05', 100000),
  // invoice 1 approved
  dr('ar', '2024-01-10', 26100),
  cr('services', '2024-01-10', 18000),
  cr('product', '2024-01-10', 4500),
  cr('tax', '2024-01-10', 3600),
  // payment on invoice 1
  dr('cash', '2024-01-20', 10000),
  cr('ar', '2024-01-20', 10000),
  // expenses paid from cash
  dr('software', '2024-02-03', 5000),
  cr('cash', '2024-02-03', 5000),
  dr('travel', '2024-02-15', 2500),
  cr('cash', '2024-02-15', 2500),
  // invoice 2 approved
  dr('ar', '2024-03-01', 12000),
  cr('services', '2024-03-01', 12000),
];

describe('naturalBalance', () => {
  it('is debit-positive for assets and expenses', () => {
    expect(naturalBalance('asset', 100, 30)).toBe(70);
    expect(naturalBalance('expense', 100, 30)).toBe(70);
    expect(naturalBalance('asset', 30, 100)).toBe(-70);
  });

  it('is credit-positive for liabilities, equity and revenue', () => {
    expect(naturalBalance('liability', 30, 100)).toBe(70);
    expect(naturalBalance('equity', 30, 100)).toBe(70);
    expect(naturalBalance('revenue', 0, 500)).toBe(500);
    expect(naturalBalance('revenue', 500, 0)).toBe(-500);
  });
});

describe('accountBalance / totalsByAccount', () => {
  it('sums only the account’s lines, in its natural direction', () => {
    expect(accountBalance(ACCOUNTS[0]!, LINES)).toBe(102500);
    expect(accountBalance(ACCOUNTS[1]!, LINES)).toBe(28100);
    expect(accountBalance(ACCOUNTS[2]!, LINES)).toBe(3600);
    expect(accountBalance(ACCOUNTS[4]!, LINES)).toBe(30000);
    expect(accountBalance(ACCOUNTS[8]!, LINES)).toBe(0);
  });

  it('honours inclusive from/to bounds', () => {
    const cash = ACCOUNTS[0]!;
    expect(accountBalance(cash, LINES, '2024-01-01', '2024-01-31')).toBe(110000);
    expect(accountBalance(cash, LINES, '2024-01-20', '2024-01-20')).toBe(10000);
    expect(accountBalance(cash, LINES, '2024-02-01', null)).toBe(-7500);
    expect(accountBalance(cash, LINES, null, '2024-01-05')).toBe(100000);
    expect(accountBalance(cash, LINES, '2024-02-04', '2024-02-14')).toBe(0);
    expect(accountBalance(cash, LINES, undefined, undefined)).toBe(102500);
  });

  it('totals debits and credits per account within a range', () => {
    const all = totalsByAccount(LINES);
    expect(all.get('cash')).toEqual({ debitCents: 110000, creditCents: 7500 });
    expect(all.get('ar')).toEqual({ debitCents: 38100, creditCents: 10000 });
    expect(all.has('other')).toBe(false);
    const feb = totalsByAccount(LINES, '2024-02-01', '2024-02-29');
    expect([...feb.keys()].sort()).toEqual(['cash', 'software', 'travel']);
    expect(feb.get('cash')).toEqual({ debitCents: 0, creditCents: 7500 });
  });
});

describe('buildProfitAndLoss', () => {
  it('reports January revenue with no expenses and a 100% margin', () => {
    const pl = buildProfitAndLoss(LINES, ACCOUNTS, { from: '2024-01-01', to: '2024-01-31' });
    expect(pl.from).toBe('2024-01-01');
    expect(pl.to).toBe('2024-01-31');
    expect(pl.compareFrom).toBeNull();
    expect(pl.compareTo).toBeNull();
    expect(pl.revenue).toEqual({
      key: 'revenue',
      title: 'Revenue',
      lines: [
        { accountId: 'services', code: '4000', name: 'Services Revenue', amountCents: 18000 },
        { accountId: 'product', code: '4100', name: 'Product Revenue', amountCents: 4500 },
      ],
      totalCents: 22500,
    });
    expect(pl.expenses).toEqual({ key: 'expenses', title: 'Expenses', lines: [], totalCents: 0 });
    expect(pl.netIncomeCents).toBe(22500);
    expect(pl.previousNetIncomeCents).toBeNull();
    expect(pl.marginBp).toBe(10000);
  });

  it('reports a loss month with a null margin when there is no revenue', () => {
    const pl = buildProfitAndLoss(LINES, ACCOUNTS, { from: '2024-02-01', to: '2024-02-29' });
    expect(pl.revenue.lines).toEqual([]);
    expect(pl.revenue.totalCents).toBe(0);
    expect(pl.expenses.lines.map((l) => [l.code, l.amountCents])).toEqual([
      ['5100', 5000],
      ['5200', 2500],
    ]);
    expect(pl.expenses.totalCents).toBe(7500);
    expect(pl.netIncomeCents).toBe(-7500);
    expect(pl.marginBp).toBeNull();
  });

  it('skips accounts with no activity in either period', () => {
    const pl = buildProfitAndLoss(LINES, ACCOUNTS, { from: '2024-01-01', to: '2024-03-31' });
    expect(pl.expenses.lines.map((l) => l.accountId)).toEqual(['software', 'travel']);
    expect(pl.expenses.lines.find((l) => l.accountId === 'other')).toBeUndefined();
    expect(pl.revenue.totalCents).toBe(34500);
    expect(pl.expenses.totalCents).toBe(7500);
    expect(pl.netIncomeCents).toBe(27000);
    expect(pl.marginBp).toBe(7826); // 27000 / 34500
  });

  it('includes comparison figures when a compare range is given', () => {
    const pl = buildProfitAndLoss(LINES, ACCOUNTS, { from: '2024-02-01', to: '2024-02-29' }, { from: '2024-01-01', to: '2024-01-31' });
    expect(pl.compareFrom).toBe('2024-01-01');
    expect(pl.compareTo).toBe('2024-01-31');
    // Revenue accounts had no February activity but appear because of the comparison.
    expect(pl.revenue.lines).toEqual([
      { accountId: 'services', code: '4000', name: 'Services Revenue', amountCents: 0, previousCents: 18000 },
      { accountId: 'product', code: '4100', name: 'Product Revenue', amountCents: 0, previousCents: 4500 },
    ]);
    expect(pl.revenue.totalCents).toBe(0);
    expect(pl.revenue.previousTotalCents).toBe(22500);
    expect(pl.expenses.lines).toEqual([
      { accountId: 'software', code: '5100', name: 'Software & Subscriptions', amountCents: 5000, previousCents: 0 },
      { accountId: 'travel', code: '5200', name: 'Travel', amountCents: 2500, previousCents: 0 },
    ]);
    expect(pl.expenses.previousTotalCents).toBe(0);
    expect(pl.netIncomeCents).toBe(-7500);
    expect(pl.previousNetIncomeCents).toBe(22500);
  });

  it('gives zero previous figures for an empty comparison period', () => {
    const pl = buildProfitAndLoss(LINES, ACCOUNTS, { from: '2024-01-01', to: '2024-03-31' }, { from: '2023-10-01', to: '2023-12-31' });
    expect(pl.previousNetIncomeCents).toBe(0);
    expect(pl.revenue.previousTotalCents).toBe(0);
    expect(pl.revenue.lines.every((l) => l.previousCents === 0)).toBe(true);
  });

  it('orders lines by account code regardless of input order', () => {
    const shuffled = [...ACCOUNTS].reverse();
    const pl = buildProfitAndLoss(LINES, shuffled, { from: '2024-01-01', to: '2024-03-31' });
    expect(pl.revenue.lines.map((l) => l.code)).toEqual(['4000', '4100']);
    expect(pl.expenses.lines.map((l) => l.code)).toEqual(['5100', '5200']);
  });
});

describe('buildBalanceSheet', () => {
  it('balances assets against liabilities, equity and current earnings at quarter end', () => {
    const bs = buildBalanceSheet(LINES, ACCOUNTS, '2024-03-31');
    expect(bs.asOf).toBe('2024-03-31');
    expect(bs.assets.lines.map((l) => [l.code, l.amountCents])).toEqual([
      ['1000', 102500],
      ['1200', 28100],
    ]);
    expect(bs.assets.totalCents).toBe(130600);
    expect(bs.liabilities.lines).toEqual([{ accountId: 'tax', code: '2200', name: 'Sales Tax Payable', amountCents: 3600 }]);
    expect(bs.liabilities.totalCents).toBe(3600);
    expect(bs.equity.totalCents).toBe(100000);
    expect(bs.currentEarningsCents).toBe(27000);
    expect(bs.totalAssetsCents).toBe(130600);
    expect(bs.totalLiabilitiesAndEquityCents).toBe(130600);
    expect(bs.balanced).toBe(true);
  });

  it('only counts lines up to asOf', () => {
    const bs = buildBalanceSheet(LINES, ACCOUNTS, '2024-01-31');
    expect(bs.assets.lines.map((l) => [l.code, l.amountCents])).toEqual([
      ['1000', 110000],
      ['1200', 16100],
    ]);
    expect(bs.currentEarningsCents).toBe(22500);
    expect(bs.totalAssetsCents).toBe(126100);
    expect(bs.totalLiabilitiesAndEquityCents).toBe(126100);
    expect(bs.balanced).toBe(true);
  });

  it('is empty before any activity', () => {
    const bs = buildBalanceSheet(LINES, ACCOUNTS, '2023-12-31');
    expect(bs.assets.lines).toEqual([]);
    expect(bs.totalAssetsCents).toBe(0);
    expect(bs.totalLiabilitiesAndEquityCents).toBe(0);
    expect(bs.balanced).toBe(true);
  });

  it('flags an unbalanced ledger', () => {
    const bs = buildBalanceSheet([...LINES, dr('cash', '2024-03-15', 1)], ACCOUNTS, '2024-03-31');
    expect(bs.totalAssetsCents).toBe(130601);
    expect(bs.balanced).toBe(false);
  });
});

describe('buildTrialBalance', () => {
  it('lists every active account by code with net debit or credit', () => {
    const tb = buildTrialBalance(LINES, ACCOUNTS, '2024-03-31');
    expect(tb.rows.map((r) => [r.code, r.debitCents, r.creditCents])).toEqual([
      ['1000', 102500, 0],
      ['1200', 28100, 0],
      ['2200', 0, 3600],
      ['3000', 0, 100000],
      ['4000', 0, 30000],
      ['4100', 0, 4500],
      ['5100', 5000, 0],
      ['5200', 2500, 0],
    ]);
    expect(tb.rows[0]).toMatchObject({ accountId: 'cash', name: 'Operating Bank Account', type: 'asset' });
    expect(tb.totalDebitCents).toBe(138100);
    expect(tb.totalCreditCents).toBe(138100);
    expect(tb.balanced).toBe(true);
  });

  it('respects asOf and detects imbalance', () => {
    const jan = buildTrialBalance(LINES, ACCOUNTS, '2024-01-31');
    expect(jan.rows.map((r) => r.code)).toEqual(['1000', '1200', '2200', '3000', '4000', '4100']);
    expect(jan.totalDebitCents).toBe(126100);
    expect(jan.balanced).toBe(true);
    const broken = buildTrialBalance([...LINES, cr('tax', '2024-03-31', 7)], ACCOUNTS, '2024-03-31');
    expect(broken.totalCreditCents).toBe(138107);
    expect(broken.balanced).toBe(false);
  });
});

describe('buildAccountTree / flattenTree', () => {
  const dto = (id: string, code: string, name: string, type: AccountType, parentId: string | null, balanceCents: number): AccountDto => ({
    id,
    workspaceId: 'w',
    code,
    name,
    type,
    parentId,
    isSystem: false,
    systemKey: null,
    archived: false,
    description: '',
    balanceCents,
  });

  const accounts = [
    dto('exp-travel', '5200', 'Travel', 'expense', 'exp', 250),
    dto('exp', '5000', 'Expenses', 'expense', null, 0),
    dto('cash', '1000', 'Cash', 'asset', null, 1000),
    dto('exp-soft', '5100', 'Software', 'expense', 'exp', 400),
    dto('exp-soft-saas', '5110', 'SaaS', 'expense', 'exp-soft', 100),
    dto('orphan', '9000', 'Orphan', 'equity', 'missing-parent', 5),
  ];

  it('nests children under parents and sorts by code at every level', () => {
    const tree = buildAccountTree(accounts);
    expect(tree.map((n) => n.code)).toEqual(['1000', '5000', '9000']);
    const exp = tree[1]!;
    expect(exp.children.map((n) => n.code)).toEqual(['5100', '5200']);
    expect(exp.children[0]?.children.map((n) => n.code)).toEqual(['5110']);
    expect(tree[0]?.children).toEqual([]);
  });

  it('rolls balances up to parents', () => {
    const tree = buildAccountTree(accounts);
    const exp = tree[1]!;
    expect(exp.balanceCents).toBe(0);
    expect(exp.rollupCents).toBe(750);
    expect(exp.children[0]?.rollupCents).toBe(500);
    expect(exp.children[0]?.children[0]?.rollupCents).toBe(100);
    expect(exp.children[1]?.rollupCents).toBe(250);
    expect(tree[0]?.rollupCents).toBe(1000);
  });

  it('treats accounts whose parent is missing as roots', () => {
    const tree = buildAccountTree(accounts);
    expect(tree[2]).toMatchObject({ id: 'orphan', rollupCents: 5, children: [] });
  });

  it('does not mutate the input', () => {
    const before = JSON.stringify(accounts);
    buildAccountTree(accounts);
    expect(JSON.stringify(accounts)).toBe(before);
    expect(buildAccountTree([])).toEqual([]);
  });

  it('flattens depth-first with depth markers', () => {
    const flat = flattenTree(buildAccountTree(accounts));
    expect(flat.map((n) => [n.code, n.depth])).toEqual([
      ['1000', 0],
      ['5000', 0],
      ['5100', 1],
      ['5110', 2],
      ['5200', 1],
      ['9000', 0],
    ]);
    expect(flat[2]?.rollupCents).toBe(500);
    expect(flattenTree([])).toEqual([]);
  });
});
