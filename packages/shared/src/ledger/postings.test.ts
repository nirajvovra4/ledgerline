import { describe, expect, it } from 'vitest';
import {
  assertBalanced,
  isBalanced,
  normalisePostings,
  type PostingLine,
  postingsForExpense,
  postingsForExpensePayment,
  postingsForInvoice,
  postingsForPayment,
  reversePostings,
  totals,
  UnbalancedEntryError,
} from './postings';

const sum = (lines: Array<{ debitCents: number; creditCents: number }>) => totals(lines);

describe('totals / isBalanced / assertBalanced', () => {
  it('totals debits and credits', () => {
    expect(
      totals([
        { debitCents: 100, creditCents: 0 },
        { debitCents: 0, creditCents: 60 },
        { debitCents: 0, creditCents: 40 },
      ]),
    ).toEqual({ debitCents: 100, creditCents: 100 });
    expect(totals([])).toEqual({ debitCents: 0, creditCents: 0 });
  });

  it('checks balance', () => {
    expect(
      isBalanced([
        { debitCents: 5, creditCents: 0 },
        { debitCents: 0, creditCents: 5 },
      ]),
    ).toBe(true);
    expect(
      isBalanced([
        { debitCents: 5, creditCents: 0 },
        { debitCents: 0, creditCents: 4 },
      ]),
    ).toBe(false);
    expect(isBalanced([])).toBe(true);
  });

  it('returns the same lines when balanced', () => {
    const lines = [
      { debitCents: 5, creditCents: 0 },
      { debitCents: 0, creditCents: 5 },
    ];
    expect(assertBalanced(lines)).toBe(lines);
  });

  it('throws UnbalancedEntryError carrying both totals', () => {
    const lines = [
      { debitCents: 500, creditCents: 0 },
      { debitCents: 0, creditCents: 300 },
    ];
    expect(() => assertBalanced(lines)).toThrow(UnbalancedEntryError);
    expect(() => assertBalanced(lines)).toThrow(
      'Journal entry is unbalanced: debits 500 ≠ credits 300',
    );
    try {
      assertBalanced(lines);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(UnbalancedEntryError);
      expect(err).toBeInstanceOf(Error);
      const e = err as UnbalancedEntryError;
      expect(e.name).toBe('UnbalancedEntryError');
      expect(e.debitCents).toBe(500);
      expect(e.creditCents).toBe(300);
    }
  });
});

describe('postingsForInvoice', () => {
  const input = {
    number: 'INV-0001',
    clientName: 'Acme',
    totalCents: 26100,
    taxCents: 3600,
    lines: [
      { accountId: 'rev-a', lineTotalCents: 18000, description: 'Design' },
      { accountId: 'rev-b', lineTotalCents: 4500, description: 'Hosting' },
    ],
  };

  it('debits AR for the total and credits revenue per line plus sales tax', () => {
    const lines = postingsForInvoice(input);
    expect(lines).toEqual([
      {
        account: { systemKey: 'accounts_receivable' },
        debitCents: 26100,
        creditCents: 0,
        description: 'Invoice INV-0001 — Acme',
      },
      {
        account: { id: 'rev-a' },
        debitCents: 0,
        creditCents: 18000,
        description: 'Invoice INV-0001: Design',
      },
      {
        account: { id: 'rev-b' },
        debitCents: 0,
        creditCents: 4500,
        description: 'Invoice INV-0001: Hosting',
      },
      {
        account: { systemKey: 'sales_tax_payable' },
        debitCents: 0,
        creditCents: 3600,
        description: 'Invoice INV-0001 — sales tax',
      },
    ]);
    expect(isBalanced(lines)).toBe(true);
    expect(sum(lines)).toEqual({ debitCents: 26100, creditCents: 26100 });
  });

  it('omits the tax line when there is no tax', () => {
    const lines = postingsForInvoice({ ...input, totalCents: 22500, taxCents: 0 });
    expect(lines).toHaveLength(3);
    expect(
      lines.some((l) => 'systemKey' in l.account && l.account.systemKey === 'sales_tax_payable'),
    ).toBe(false);
    expect(isBalanced(lines)).toBe(true);
  });

  it('merges lines that hit the same account with the same description', () => {
    const lines = postingsForInvoice({
      number: 'INV-2',
      clientName: 'Acme',
      totalCents: 300,
      taxCents: 0,
      lines: [
        { accountId: 'rev-a', lineTotalCents: 100, description: 'Hours' },
        { accountId: 'rev-a', lineTotalCents: 200, description: 'Hours' },
      ],
    });
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual({
      account: { id: 'rev-a' },
      debitCents: 0,
      creditCents: 300,
      description: 'Invoice INV-2: Hours',
    });
  });

  it('keeps lines on the same account apart when their descriptions differ', () => {
    const lines = postingsForInvoice({
      number: 'INV-3',
      clientName: 'Acme',
      totalCents: 300,
      taxCents: 0,
      lines: [
        { accountId: 'rev-a', lineTotalCents: 100, description: 'Hours' },
        { accountId: 'rev-a', lineTotalCents: 200, description: 'Expenses' },
      ],
    });
    expect(lines).toHaveLength(3);
  });

  it('drops zero-value lines', () => {
    const lines = postingsForInvoice({
      number: 'INV-4',
      clientName: 'Acme',
      totalCents: 100,
      taxCents: 0,
      lines: [
        { accountId: 'rev-a', lineTotalCents: 100, description: 'Hours' },
        { accountId: 'rev-b', lineTotalCents: 0, description: 'Free' },
      ],
    });
    expect(lines).toHaveLength(2);
  });

  it('throws when the total does not equal lines plus tax', () => {
    expect(() => postingsForInvoice({ ...input, totalCents: 26000 })).toThrow(UnbalancedEntryError);
    try {
      postingsForInvoice({ ...input, totalCents: 26000 });
    } catch (err) {
      expect(err).toMatchObject({ debitCents: 26000, creditCents: 26100 });
    }
  });
});

describe('postingsForPayment', () => {
  it('debits cash and credits AR', () => {
    const lines = postingsForPayment({
      invoiceNumber: 'INV-0001',
      clientName: 'Acme',
      amountCents: 10000,
    });
    expect(lines).toEqual([
      {
        account: { systemKey: 'cash' },
        debitCents: 10000,
        creditCents: 0,
        description: 'Payment for INV-0001 — Acme',
      },
      {
        account: { systemKey: 'accounts_receivable' },
        debitCents: 0,
        creditCents: 10000,
        description: 'Payment for INV-0001 — Acme',
      },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it('appends the reference when given', () => {
    const lines = postingsForPayment({
      invoiceNumber: 'INV-0001',
      clientName: 'Acme',
      amountCents: 1,
      reference: 'TXN 42',
    });
    expect(lines[0]?.description).toBe('Payment for INV-0001 — Acme (TXN 42)');
    expect(lines[1]?.description).toBe('Payment for INV-0001 — Acme (TXN 42)');
    expect(
      postingsForPayment({ invoiceNumber: 'X', clientName: 'Y', amountCents: 1, reference: '' })[0]
        ?.description,
    ).toBe('Payment for X — Y');
  });
});

describe('postingsForExpense', () => {
  const input = {
    vendor: 'Adobe',
    description: 'Creative Cloud',
    accountId: 'exp-software',
    amountCents: 5000,
    taxCents: 1000,
    totalCents: 6000,
  };

  it('debits the expense account and input tax, credits AP for the total', () => {
    const lines = postingsForExpense(input);
    expect(lines).toEqual([
      {
        account: { id: 'exp-software' },
        debitCents: 5000,
        creditCents: 0,
        description: 'Adobe: Creative Cloud',
      },
      {
        account: { systemKey: 'input_tax' },
        debitCents: 1000,
        creditCents: 0,
        description: 'Adobe: Creative Cloud — input tax',
      },
      {
        account: { systemKey: 'accounts_payable' },
        debitCents: 0,
        creditCents: 6000,
        description: 'Adobe: Creative Cloud',
      },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it('omits input tax when there is none', () => {
    const lines = postingsForExpense({ ...input, taxCents: 0, totalCents: 5000 });
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.account)).toEqual([
      { id: 'exp-software' },
      { systemKey: 'accounts_payable' },
    ]);
    expect(isBalanced(lines)).toBe(true);
  });

  it('throws when net + tax does not equal total', () => {
    expect(() => postingsForExpense({ ...input, totalCents: 5500 })).toThrow(UnbalancedEntryError);
    expect(() => postingsForExpense({ ...input, totalCents: 5500 })).toThrow(
      /debits 6000 ≠ credits 5500/,
    );
  });
});

describe('postingsForExpensePayment', () => {
  it('debits AP and credits cash', () => {
    const lines = postingsForExpensePayment({ vendor: 'Adobe', totalCents: 6000 });
    expect(lines).toEqual([
      {
        account: { systemKey: 'accounts_payable' },
        debitCents: 6000,
        creditCents: 0,
        description: 'Paid Adobe',
      },
      {
        account: { systemKey: 'cash' },
        debitCents: 0,
        creditCents: 6000,
        description: 'Paid Adobe',
      },
    ]);
    expect(
      postingsForExpensePayment({ vendor: 'Adobe', totalCents: 1, reference: 'CHQ 7' })[0]
        ?.description,
    ).toBe('Paid Adobe (CHQ 7)');
  });
});

describe('reversePostings', () => {
  it('swaps debits and credits while keeping the other fields', () => {
    const original = postingsForInvoice({
      number: 'INV-1',
      clientName: 'Acme',
      totalCents: 120,
      taxCents: 20,
      lines: [{ accountId: 'rev', lineTotalCents: 100, description: 'Work' }],
    });
    const reversed = reversePostings(original);
    expect(reversed).toEqual([
      {
        account: { systemKey: 'accounts_receivable' },
        debitCents: 0,
        creditCents: 120,
        description: 'Invoice INV-1 — Acme',
      },
      {
        account: { id: 'rev' },
        debitCents: 100,
        creditCents: 0,
        description: 'Invoice INV-1: Work',
      },
      {
        account: { systemKey: 'sales_tax_payable' },
        debitCents: 20,
        creditCents: 0,
        description: 'Invoice INV-1 — sales tax',
      },
    ]);
    expect(isBalanced(reversed)).toBe(true);
    expect(reversePostings(reversed)).toEqual(original);
    expect(original[0]?.debitCents).toBe(120); // untouched
  });

  it('preserves extra properties on the lines', () => {
    const lines = [{ id: 'l1', accountId: 'a', debitCents: 10, creditCents: 0 }];
    expect(reversePostings(lines)).toEqual([
      { id: 'l1', accountId: 'a', debitCents: 0, creditCents: 10 },
    ]);
  });
});

describe('normalisePostings', () => {
  const line = (
    account: PostingLine['account'],
    debitCents: number,
    creditCents: number,
    description = 'd',
  ): PostingLine => ({
    account,
    debitCents,
    creditCents,
    description,
  });

  it('drops zero lines', () => {
    expect(normalisePostings([line({ id: 'a' }, 0, 0), line({ id: 'b' }, 5, 0)])).toEqual([
      line({ id: 'b' }, 5, 0),
    ]);
  });

  it('merges same account + description and nets debit against credit', () => {
    expect(normalisePostings([line({ id: 'a' }, 100, 0), line({ id: 'a' }, 0, 30)])).toEqual([
      line({ id: 'a' }, 70, 0),
    ]);
    expect(normalisePostings([line({ id: 'a' }, 20, 0), line({ id: 'a' }, 0, 50)])).toEqual([
      line({ id: 'a' }, 0, 30),
    ]);
    expect(normalisePostings([line({ id: 'a' }, 50, 0), line({ id: 'a' }, 0, 50)])).toEqual([]);
  });

  it('keeps different descriptions and different account kinds separate', () => {
    expect(
      normalisePostings([line({ id: 'a' }, 10, 0, 'x'), line({ id: 'a' }, 10, 0, 'y')]),
    ).toHaveLength(2);
    expect(
      normalisePostings([line({ id: 'cash' }, 10, 0), line({ systemKey: 'cash' }, 10, 0)]),
    ).toHaveLength(2);
    expect(
      normalisePostings([line({ systemKey: 'cash' }, 10, 0), line({ systemKey: 'cash' }, 15, 0)]),
    ).toEqual([line({ systemKey: 'cash' }, 25, 0)]);
  });

  it('preserves first-seen order and does not mutate its input', () => {
    const input = [line({ id: 'b' }, 1, 0), line({ id: 'a' }, 0, 1), line({ id: 'b' }, 2, 0)];
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = normalisePostings(input);
    expect(out.map((l) => l.account)).toEqual([{ id: 'b' }, { id: 'a' }]);
    expect(out[0]?.debitCents).toBe(3);
    expect(input).toEqual(snapshot);
  });
});
