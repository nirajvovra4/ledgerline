import { describe, expect, it } from 'vitest';
import {
  ACCOUNT_TYPES,
  AGING_BUCKETS,
  APPROVAL_STATUSES,
  BP_DENOMINATOR,
  CURRENCIES,
  CURRENCY_CODES,
  currencyInfo,
  DEBIT_NORMAL_TYPES,
  DEFAULT_PAGE_SIZE,
  DEFAULT_WORKSPACE_SETTINGS,
  EXPENSE_STATUSES,
  INVOICE_STATUSES,
  labelFor,
  MAX_PAGE_SIZE,
  MIN_PASSWORD_LENGTH,
  NOTIFICATION_KINDS,
  PAYMENT_METHODS,
  PROJECT_STATUSES,
  ROLES,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  SYSTEM_ACCOUNTS,
  toneFor,
} from './constants';
import type { AccountType, SystemAccountKey } from './types';

describe('labelFor / toneFor', () => {
  it('looks up labels and tones', () => {
    expect(labelFor(INVOICE_STATUSES, 'partially_paid')).toBe('Partially paid');
    expect(labelFor(EXPENSE_STATUSES, 'pending_approval')).toBe('Pending approval');
    expect(labelFor(PAYMENT_METHODS, 'bank_transfer')).toBe('Bank transfer');
    expect(toneFor(INVOICE_STATUSES, 'overdue')).toBe('negative');
    expect(toneFor(INVOICE_STATUSES, 'paid')).toBe('positive');
    expect(toneFor(INVOICE_STATUSES, 'draft')).toBe('muted');
    expect(toneFor(APPROVAL_STATUSES, 'pending')).toBe('warning');
  });

  it('falls back to the raw value and a neutral tone', () => {
    expect(labelFor(INVOICE_STATUSES, 'mystery' as never)).toBe('mystery');
    expect(toneFor(INVOICE_STATUSES, 'mystery' as never)).toBe('neutral');
    expect(labelFor([], 'x')).toBe('x');
  });
});

describe('option lists', () => {
  it('cover every enum value exactly once', () => {
    expect(ROLES.map((r) => r.value)).toEqual(['owner', 'admin', 'accountant', 'member']);
    expect(INVOICE_STATUSES.map((s) => s.value)).toEqual(['draft', 'pending_approval', 'approved', 'sent', 'partially_paid', 'paid', 'overdue', 'void']);
    expect(EXPENSE_STATUSES.map((s) => s.value)).toEqual(['draft', 'pending_approval', 'approved', 'paid', 'rejected']);
    expect(PROJECT_STATUSES.map((s) => s.value)).toEqual(['active', 'on_hold', 'completed', 'archived']);
    expect(APPROVAL_STATUSES.map((s) => s.value)).toEqual(['pending', 'approved', 'rejected']);
    expect(PAYMENT_METHODS.map((s) => s.value)).toEqual(['bank_transfer', 'card', 'cash', 'cheque', 'other']);
    expect(ACCOUNT_TYPES.map((s) => s.value)).toEqual(['asset', 'liability', 'equity', 'revenue', 'expense']);
    expect(NOTIFICATION_KINDS.map((s) => s.value)).toEqual([
      'approval_requested',
      'approval_decided',
      'invoice_sent',
      'payment_received',
      'invoice_overdue',
      'member_joined',
      'mention',
      'system',
    ]);
  });

  it('give every option a non-empty label', () => {
    for (const list of [ROLES, INVOICE_STATUSES, EXPENSE_STATUSES, PROJECT_STATUSES, APPROVAL_STATUSES, PAYMENT_METHODS, ACCOUNT_TYPES, NOTIFICATION_KINDS]) {
      for (const o of list) expect(o.label.length).toBeGreaterThan(0);
    }
  });

  it('marks assets and expenses as debit-normal', () => {
    expect([...DEBIT_NORMAL_TYPES].sort()).toEqual(['asset', 'expense']);
  });
});

describe('currencies', () => {
  it('returns known currency info', () => {
    expect(currencyInfo('USD')).toEqual({ code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 });
    expect(currencyInfo('JPY')).toMatchObject({ symbol: '¥', decimals: 0 });
    expect(currencyInfo('CHF')).toMatchObject({ symbol: 'CHF', decimals: 2 });
  });

  it('falls back to the code itself for unknown currencies', () => {
    expect(currencyInfo('XYZ')).toEqual({ code: 'XYZ', name: 'XYZ', symbol: 'XYZ', decimals: 2 });
    expect(currencyInfo('')).toEqual({ code: '', name: '', symbol: '', decimals: 2 });
  });

  it('lists unique codes', () => {
    expect(CURRENCY_CODES).toEqual(CURRENCIES.map((c) => c.code));
    expect(new Set(CURRENCY_CODES).size).toBe(CURRENCIES.length);
    expect(CURRENCY_CODES).toContain('USD');
    expect(CURRENCY_CODES).toContain('EUR');
    expect(CURRENCY_CODES).toContain('GBP');
    for (const c of CURRENCIES) expect(c.code).toMatch(/^[A-Z]{3}$/);
  });
});

describe('SYSTEM_ACCOUNTS', () => {
  /** The table from docs/DESIGN.md §2 "System accounts". */
  const DESIGN_TABLE: Array<[SystemAccountKey, string, string, AccountType]> = [
    ['cash', '1000', 'Operating Bank Account', 'asset'],
    ['accounts_receivable', '1200', 'Accounts Receivable', 'asset'],
    ['input_tax', '1300', 'Input Tax Receivable', 'asset'],
    ['accounts_payable', '2000', 'Accounts Payable', 'liability'],
    ['sales_tax_payable', '2200', 'Sales Tax Payable', 'liability'],
    ['owner_equity', '3000', "Owner's Equity", 'equity'],
    ['retained_earnings', '3900', 'Retained Earnings', 'equity'],
    ['services_revenue', '4000', 'Services Revenue', 'revenue'],
    ['product_revenue', '4100', 'Product Revenue', 'revenue'],
    ['other_income', '4900', 'Other Income', 'revenue'],
    ['software_expense', '5100', 'Software & Subscriptions', 'expense'],
    ['travel_expense', '5200', 'Travel', 'expense'],
    ['contractor_expense', '5300', 'Contractors', 'expense'],
    ['office_expense', '5400', 'Office & Equipment', 'expense'],
    ['marketing_expense', '5500', 'Marketing', 'expense'],
    ['other_expense', '5900', 'Other Expenses', 'expense'],
  ];

  it('matches the design table in order', () => {
    expect(SYSTEM_ACCOUNTS.map((a) => [a.key, a.code, a.name, a.type])).toEqual(DESIGN_TABLE);
  });

  it('has unique keys and codes', () => {
    expect(new Set(SYSTEM_ACCOUNTS.map((a) => a.key)).size).toBe(SYSTEM_ACCOUNTS.length);
    expect(new Set(SYSTEM_ACCOUNTS.map((a) => a.code)).size).toBe(SYSTEM_ACCOUNTS.length);
    expect(SYSTEM_ACCOUNTS).toHaveLength(16);
  });

  it('uses numeric codes whose leading digit matches the account type', () => {
    const leading: Record<AccountType, string> = { asset: '1', liability: '2', equity: '3', revenue: '4', expense: '5' };
    for (const a of SYSTEM_ACCOUNTS) {
      expect(a.code).toMatch(/^\d{4}$/);
      expect(a.code[0]).toBe(leading[a.type]);
      expect(typeof a.description).toBe('string');
    }
  });
});

describe('aging buckets and misc constants', () => {
  it('defines contiguous aging buckets in order', () => {
    expect(AGING_BUCKETS.map((b) => b.key)).toEqual(['current', 'd1_30', 'd31_60', 'd61_90', 'd90_plus']);
    expect(AGING_BUCKETS[0]).toMatchObject({ minDays: -Infinity, maxDays: 0 });
    expect(AGING_BUCKETS[AGING_BUCKETS.length - 1]).toMatchObject({ minDays: 91, maxDays: null });
    for (let i = 1; i < AGING_BUCKETS.length; i++) {
      expect(AGING_BUCKETS[i]?.minDays).toBe((AGING_BUCKETS[i - 1]?.maxDays ?? 0) + 1);
    }
  });

  it('exposes the documented defaults', () => {
    expect(DEFAULT_WORKSPACE_SETTINGS).toMatchObject({
      invoicePrefix: 'INV',
      nextInvoiceNumber: 1,
      invoiceNumberPadding: 4,
      defaultPaymentTermsDays: 30,
      defaultTaxRateId: null,
      requireInvoiceApproval: true,
      requireExpenseApproval: true,
      fiscalYearStartMonth: 1,
    });
    expect(DEFAULT_PAGE_SIZE).toBe(25);
    expect(MAX_PAGE_SIZE).toBe(200);
    expect(SESSION_COOKIE).toBe('ll_session');
    expect(SESSION_TTL_DAYS).toBe(30);
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(BP_DENOMINATOR).toBe(10000);
  });
});
