import type { Cents, SystemAccountKey } from '../types';

/**
 * Double-entry posting rules. These functions return *proposed* journal lines; the API resolves
 * system-account keys to real account ids and persists the entry.
 */

export interface PostingLine {
  /** Either a concrete account id or a system-account key to resolve. */
  account: { id: string } | { systemKey: SystemAccountKey };
  debitCents: Cents;
  creditCents: Cents;
  description: string;
}

export class UnbalancedEntryError extends Error {
  constructor(
    public readonly debitCents: Cents,
    public readonly creditCents: Cents,
  ) {
    super(`Journal entry is unbalanced: debits ${debitCents} ≠ credits ${creditCents}`);
    this.name = 'UnbalancedEntryError';
  }
}

export function totals(lines: Array<{ debitCents: Cents; creditCents: Cents }>): { debitCents: Cents; creditCents: Cents } {
  let debitCents = 0;
  let creditCents = 0;
  for (const l of lines) {
    debitCents += l.debitCents;
    creditCents += l.creditCents;
  }
  return { debitCents, creditCents };
}

export function isBalanced(lines: Array<{ debitCents: Cents; creditCents: Cents }>): boolean {
  const t = totals(lines);
  return t.debitCents === t.creditCents;
}

export function assertBalanced<T extends { debitCents: Cents; creditCents: Cents }>(lines: T[]): T[] {
  const t = totals(lines);
  if (t.debitCents !== t.creditCents) throw new UnbalancedEntryError(t.debitCents, t.creditCents);
  return lines;
}

/** Drop zero lines and merge lines that hit the same account with the same description. */
export function normalisePostings(lines: PostingLine[]): PostingLine[] {
  const merged = new Map<string, PostingLine>();
  for (const line of lines) {
    if (line.debitCents === 0 && line.creditCents === 0) continue;
    const key = `${'id' in line.account ? `id:${line.account.id}` : `sys:${line.account.systemKey}`}|${line.description}`;
    const existing = merged.get(key);
    if (existing) {
      existing.debitCents += line.debitCents;
      existing.creditCents += line.creditCents;
    } else {
      merged.set(key, { ...line });
    }
  }
  // Net debit/credit on the same line.
  return [...merged.values()]
    .map((l) => {
      const net = l.debitCents - l.creditCents;
      return { ...l, debitCents: net > 0 ? net : 0, creditCents: net < 0 ? -net : 0 };
    })
    .filter((l) => l.debitCents !== 0 || l.creditCents !== 0);
}

export interface InvoicePostingInput {
  number: string;
  clientName: string;
  totalCents: Cents;
  taxCents: Cents;
  lines: Array<{ accountId: string; lineTotalCents: Cents; description: string }>;
}

/** Invoice approval: Dr AR total / Cr revenue per line, Cr sales tax payable. */
export function postingsForInvoice(input: InvoicePostingInput): PostingLine[] {
  const lines: PostingLine[] = [
    {
      account: { systemKey: 'accounts_receivable' },
      debitCents: input.totalCents,
      creditCents: 0,
      description: `Invoice ${input.number} — ${input.clientName}`,
    },
  ];
  for (const line of input.lines) {
    lines.push({
      account: { id: line.accountId },
      debitCents: 0,
      creditCents: line.lineTotalCents,
      description: `Invoice ${input.number}: ${line.description}`,
    });
  }
  if (input.taxCents !== 0) {
    lines.push({
      account: { systemKey: 'sales_tax_payable' },
      debitCents: 0,
      creditCents: input.taxCents,
      description: `Invoice ${input.number} — sales tax`,
    });
  }
  return assertBalanced(normalisePostings(lines));
}

export interface PaymentPostingInput {
  invoiceNumber: string;
  clientName: string;
  amountCents: Cents;
  reference?: string;
}

/** Payment received: Dr cash / Cr AR. */
export function postingsForPayment(input: PaymentPostingInput): PostingLine[] {
  const desc = `Payment for ${input.invoiceNumber} — ${input.clientName}${input.reference ? ` (${input.reference})` : ''}`;
  return assertBalanced([
    { account: { systemKey: 'cash' }, debitCents: input.amountCents, creditCents: 0, description: desc },
    { account: { systemKey: 'accounts_receivable' }, debitCents: 0, creditCents: input.amountCents, description: desc },
  ]);
}

export interface ExpensePostingInput {
  vendor: string;
  description: string;
  accountId: string;
  amountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

/** Expense approved: Dr expense account (net), Dr input tax / Cr AP (total). */
export function postingsForExpense(input: ExpensePostingInput): PostingLine[] {
  const desc = `${input.vendor}: ${input.description}`;
  const lines: PostingLine[] = [
    { account: { id: input.accountId }, debitCents: input.amountCents, creditCents: 0, description: desc },
  ];
  if (input.taxCents !== 0) {
    lines.push({ account: { systemKey: 'input_tax' }, debitCents: input.taxCents, creditCents: 0, description: `${desc} — input tax` });
  }
  lines.push({ account: { systemKey: 'accounts_payable' }, debitCents: 0, creditCents: input.totalCents, description: desc });
  return assertBalanced(normalisePostings(lines));
}

/** Expense paid: Dr AP / Cr cash. */
export function postingsForExpensePayment(input: { vendor: string; totalCents: Cents; reference?: string }): PostingLine[] {
  const desc = `Paid ${input.vendor}${input.reference ? ` (${input.reference})` : ''}`;
  return assertBalanced([
    { account: { systemKey: 'accounts_payable' }, debitCents: input.totalCents, creditCents: 0, description: desc },
    { account: { systemKey: 'cash' }, debitCents: 0, creditCents: input.totalCents, description: desc },
  ]);
}

/** Swap debits and credits to reverse an entry. */
export function reversePostings<T extends { debitCents: Cents; creditCents: Cents }>(lines: T[]): T[] {
  return lines.map((l) => ({ ...l, debitCents: l.creditCents, creditCents: l.debitCents }));
}
