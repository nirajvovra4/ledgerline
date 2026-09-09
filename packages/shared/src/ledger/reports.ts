import { DEBIT_NORMAL_TYPES } from '../constants';
import { shareBp } from '../money';
import type {
  AccountDto,
  AccountNode,
  AccountType,
  BalanceSheetDto,
  Cents,
  IsoDate,
  ProfitLossDto,
  ReportLine,
  ReportSection,
  TrialBalanceDto,
} from '../types';

export interface LedgerLineLike {
  accountId: string;
  date: IsoDate;
  debitCents: Cents;
  creditCents: Cents;
}

export type AccountLike = Pick<AccountDto, 'id' | 'code' | 'name' | 'type' | 'parentId'>;

/**
 * Signed balance in the account's natural direction: positive means the account holds a balance
 * of its normal kind (debit for assets/expenses, credit for liabilities/equity/revenue).
 */
export function naturalBalance(type: AccountType, debitCents: Cents, creditCents: Cents): Cents {
  return DEBIT_NORMAL_TYPES.has(type) ? debitCents - creditCents : creditCents - debitCents;
}

export function accountBalance(account: AccountLike, lines: LedgerLineLike[], from?: IsoDate | null, to?: IsoDate | null): Cents {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    if (l.accountId !== account.id) continue;
    if (from && l.date < from) continue;
    if (to && l.date > to) continue;
    debit += l.debitCents;
    credit += l.creditCents;
  }
  return naturalBalance(account.type, debit, credit);
}

/** Sum debits/credits per account within an optional range. */
export function totalsByAccount(lines: LedgerLineLike[], from?: IsoDate | null, to?: IsoDate | null): Map<string, { debitCents: Cents; creditCents: Cents }> {
  const map = new Map<string, { debitCents: Cents; creditCents: Cents }>();
  for (const l of lines) {
    if (from && l.date < from) continue;
    if (to && l.date > to) continue;
    let t = map.get(l.accountId);
    if (!t) {
      t = { debitCents: 0, creditCents: 0 };
      map.set(l.accountId, t);
    }
    t.debitCents += l.debitCents;
    t.creditCents += l.creditCents;
  }
  return map;
}

function sectionFor(
  key: string,
  title: string,
  accounts: AccountLike[],
  type: AccountType,
  current: Map<string, { debitCents: Cents; creditCents: Cents }>,
  previous?: Map<string, { debitCents: Cents; creditCents: Cents }>,
): ReportSection {
  const lines: ReportLine[] = [];
  let totalCents = 0;
  let previousTotalCents = 0;
  for (const a of accounts.filter((x) => x.type === type).sort((x, y) => x.code.localeCompare(y.code))) {
    const t = current.get(a.id) ?? { debitCents: 0, creditCents: 0 };
    const amount = naturalBalance(type, t.debitCents, t.creditCents);
    const p = previous?.get(a.id);
    const prevAmount = p ? naturalBalance(type, p.debitCents, p.creditCents) : 0;
    if (amount === 0 && prevAmount === 0) continue;
    const line: ReportLine = { accountId: a.id, code: a.code, name: a.name, amountCents: amount };
    if (previous) line.previousCents = prevAmount;
    lines.push(line);
    totalCents += amount;
    previousTotalCents += prevAmount;
  }
  const section: ReportSection = { key, title, lines, totalCents };
  if (previous) section.previousTotalCents = previousTotalCents;
  return section;
}

export function buildProfitAndLoss(
  lines: LedgerLineLike[],
  accounts: AccountLike[],
  range: { from: IsoDate; to: IsoDate },
  compare?: { from: IsoDate; to: IsoDate } | null,
): ProfitLossDto {
  const current = totalsByAccount(lines, range.from, range.to);
  const previous = compare ? totalsByAccount(lines, compare.from, compare.to) : undefined;
  const revenue = sectionFor('revenue', 'Revenue', accounts, 'revenue', current, previous);
  const expenses = sectionFor('expenses', 'Expenses', accounts, 'expense', current, previous);
  const netIncomeCents = revenue.totalCents - expenses.totalCents;
  const previousNetIncomeCents = compare ? (revenue.previousTotalCents ?? 0) - (expenses.previousTotalCents ?? 0) : null;
  return {
    from: range.from,
    to: range.to,
    compareFrom: compare?.from ?? null,
    compareTo: compare?.to ?? null,
    revenue,
    expenses,
    netIncomeCents,
    previousNetIncomeCents,
    marginBp: revenue.totalCents > 0 ? shareBp(netIncomeCents, revenue.totalCents) : null,
  };
}

export function buildBalanceSheet(lines: LedgerLineLike[], accounts: AccountLike[], asOf: IsoDate): BalanceSheetDto {
  const cumulative = totalsByAccount(lines, null, asOf);
  const assets = sectionFor('assets', 'Assets', accounts, 'asset', cumulative);
  const liabilities = sectionFor('liabilities', 'Liabilities', accounts, 'liability', cumulative);
  const equity = sectionFor('equity', 'Equity', accounts, 'equity', cumulative);
  // Current earnings = lifetime revenue − lifetime expenses up to asOf (no period close in this model).
  const revenue = sectionFor('r', 'r', accounts, 'revenue', cumulative);
  const expenses = sectionFor('e', 'e', accounts, 'expense', cumulative);
  const currentEarningsCents = revenue.totalCents - expenses.totalCents;
  const totalAssetsCents = assets.totalCents;
  const totalLiabilitiesAndEquityCents = liabilities.totalCents + equity.totalCents + currentEarningsCents;
  return {
    asOf,
    assets,
    liabilities,
    equity,
    currentEarningsCents,
    totalAssetsCents,
    totalLiabilitiesAndEquityCents,
    balanced: totalAssetsCents === totalLiabilitiesAndEquityCents,
  };
}

export function buildTrialBalance(lines: LedgerLineLike[], accounts: AccountLike[], asOf: IsoDate): TrialBalanceDto {
  const cumulative = totalsByAccount(lines, null, asOf);
  const rows = accounts
    .slice()
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((a) => {
      const t = cumulative.get(a.id) ?? { debitCents: 0, creditCents: 0 };
      const net = t.debitCents - t.creditCents;
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        debitCents: net > 0 ? net : 0,
        creditCents: net < 0 ? -net : 0,
      };
    })
    .filter((r) => r.debitCents !== 0 || r.creditCents !== 0);
  const totalDebitCents = rows.reduce((s, r) => s + r.debitCents, 0);
  const totalCreditCents = rows.reduce((s, r) => s + r.creditCents, 0);
  return { asOf, rows, totalDebitCents, totalCreditCents, balanced: totalDebitCents === totalCreditCents };
}

/** Arrange flat accounts into a tree ordered by code, rolling balances up to parents. */
export function buildAccountTree(accounts: AccountDto[]): AccountNode[] {
  const nodes = new Map<string, AccountNode>();
  for (const a of accounts) nodes.set(a.id, { ...a, children: [], rollupCents: a.balanceCents });
  const roots: AccountNode[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }
  const sortRec = (list: AccountNode[]): void => {
    list.sort((a, b) => a.code.localeCompare(b.code));
    for (const n of list) sortRec(n.children);
  };
  sortRec(roots);
  const rollup = (n: AccountNode): Cents => {
    n.rollupCents = n.balanceCents + n.children.reduce((s, c) => s + rollup(c), 0);
    return n.rollupCents;
  };
  for (const r of roots) rollup(r);
  return roots;
}

export function flattenTree(nodes: AccountNode[], depth = 0): Array<AccountNode & { depth: number }> {
  const out: Array<AccountNode & { depth: number }> = [];
  for (const n of nodes) {
    out.push({ ...n, depth });
    out.push(...flattenTree(n.children, depth + 1));
  }
  return out;
}
