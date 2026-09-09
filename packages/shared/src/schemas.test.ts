import { describe, expect, it } from 'vitest';
import type { ZodTypeAny, z } from 'zod';
import { DEFAULT_WORKSPACE_SETTINGS } from './constants';
import {
  accountInputSchema,
  approvalDecisionSchema,
  approvalListQuerySchema,
  asOfSchema,
  bpSchema,
  changePasswordSchema,
  clientInputSchema,
  clientListQuerySchema,
  createWorkspaceSchema,
  dashboardQuerySchema,
  dateRangeSchema,
  expenseInputSchema,
  expenseListQuerySchema,
  invoiceFromTimeSchema,
  invoiceInputSchema,
  invoiceLineInputSchema,
  invoiceListQuerySchema,
  invoiceStatusFilterSchema,
  inviteMemberSchema,
  isoDateSchema,
  journalListQuerySchema,
  listQuerySchema,
  loginSchema,
  manualJournalEntrySchema,
  monthQuerySchema,
  optionalIsoDateSchema,
  optionalString,
  payExpenseSchema,
  paymentListQuerySchema,
  profitLossQuerySchema,
  projectInputSchema,
  projectListQuerySchema,
  recordPaymentSchema,
  registerSchema,
  rejectionSchema,
  reverseEntrySchema,
  searchQuerySchema,
  taxRateInputSchema,
  timeEntryInputSchema,
  timeEntryListQuerySchema,
  updateMemberRoleSchema,
  updateProfileSchema,
  updateWorkspaceSchema,
  uuidSchema,
  voidInvoiceSchema,
  workspaceSettingsSchema,
} from './schemas';
import { issuesByField, validate } from './validation';

const U1 = '11111111-1111-4111-8111-111111111111';
const U2 = '22222222-2222-4222-8222-222222222222';
const U3 = '33333333-3333-4333-8333-333333333333';

/** Parse and return the data, failing loudly when the schema rejects it. */
function ok<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const r = validate(schema, data);
  if (!r.ok) throw new Error(`expected ok, got issues: ${JSON.stringify(r.issues)}`);
  return r.data;
}

/** Parse and return `{ path: message }`, failing loudly when the schema accepts the data. */
function bad<S extends ZodTypeAny>(schema: S, data: unknown): Record<string, string> {
  const r = validate(schema, data);
  if (r.ok) throw new Error(`expected failure, got ok: ${JSON.stringify(r.data)}`);
  return issuesByField(r.issues);
}

describe('primitives', () => {
  it('validates ISO dates', () => {
    expect(ok(isoDateSchema, '2024-02-29')).toBe('2024-02-29');
    expect(bad(isoDateSchema, '2024-02-30')).toEqual({ _: 'Enter a valid date (YYYY-MM-DD)' });
    expect(bad(isoDateSchema, '01/02/2024')._).toBeDefined();
  });

  it('normalises optional dates to null', () => {
    expect(ok(optionalIsoDateSchema, undefined)).toBeNull();
    expect(ok(optionalIsoDateSchema, '')).toBeNull();
    expect(ok(optionalIsoDateSchema, null)).toBeNull();
    expect(ok(optionalIsoDateSchema, '2024-01-01')).toBe('2024-01-01');
    expect(bad(optionalIsoDateSchema, 'nope')._).toBe('Enter a valid date (YYYY-MM-DD)');
  });

  it('bounds basis points and ids', () => {
    expect(ok(bpSchema, 0)).toBe(0);
    expect(ok(bpSchema, 10000)).toBe(10000);
    expect(bad(bpSchema, -1)._).toBe('Cannot be negative');
    expect(bad(bpSchema, 10001)._).toBe('Cannot exceed 100%');
    expect(bad(bpSchema, 12.5)._).toBeDefined();
    expect(ok(uuidSchema, U1)).toBe(U1);
    expect(bad(uuidSchema, 'not-a-uuid')._).toBe('Invalid id');
  });

  it('optionalString trims and defaults to empty', () => {
    const s = optionalString(5, 'Note');
    expect(ok(s, undefined)).toBe('');
    expect(ok(s, null)).toBe('');
    expect(ok(s, '  hi ')).toBe('hi');
    expect(bad(s, 'toolong')._).toBe('Note must be 5 characters or fewer');
  });
});

describe('auth schemas', () => {
  it('registerSchema normalises the email and enforces password length', () => {
    expect(ok(registerSchema, { name: ' Ada ', email: ' Ada@Example.COM ', password: 'password123' })).toEqual({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'password123',
    });
    expect(ok(registerSchema, { name: 'Ada', email: 'a@b.co', password: 'password123', inviteToken: ' tok ' }).inviteToken).toBe('tok');
    expect(bad(registerSchema, { name: 'Ada', email: 'a@b.co', password: 'short' })).toEqual({ password: 'Password must be at least 8 characters' });
    expect(bad(registerSchema, { name: '', email: 'nope', password: 'password123' })).toEqual({
      name: 'Name is required',
      email: 'Enter a valid email address',
    });
    expect(bad(registerSchema, { email: 'a@b.co', password: 'password123' }).name).toBe('Name is required');
    expect(bad(registerSchema, { name: 'x'.repeat(81), email: 'a@b.co', password: 'password123' }).name).toBe('Name must be 80 characters or fewer');
  });

  it('loginSchema requires a password', () => {
    expect(ok(loginSchema, { email: 'A@B.CO', password: 'x' })).toEqual({ email: 'a@b.co', password: 'x' });
    expect(bad(loginSchema, { email: 'a@b.co', password: '' })).toEqual({ password: 'Enter your password' });
  });

  it('profile and password change', () => {
    expect(ok(updateProfileSchema, { name: 'Ada', email: 'a@b.co' })).toEqual({ name: 'Ada', email: 'a@b.co' });
    expect(ok(changePasswordSchema, { currentPassword: 'old', newPassword: 'newpassword', confirmPassword: 'newpassword' }).newPassword).toBe('newpassword');
    expect(bad(changePasswordSchema, { currentPassword: 'old', newPassword: 'newpassword', confirmPassword: 'other' })).toEqual({
      confirmPassword: 'Passwords do not match',
    });
    expect(bad(changePasswordSchema, { currentPassword: '', newPassword: 'short', confirmPassword: 'short' })).toEqual({
      currentPassword: 'Enter your current password',
      newPassword: 'Password must be at least 8 characters',
    });
  });
});

describe('workspace schemas', () => {
  it('accepts the default settings', () => {
    expect(ok(workspaceSettingsSchema, DEFAULT_WORKSPACE_SETTINGS)).toEqual(DEFAULT_WORKSPACE_SETTINGS);
    expect(ok(workspaceSettingsSchema, { ...DEFAULT_WORKSPACE_SETTINGS, defaultTaxRateId: U1, email: 'Ops@Studio.io' })).toMatchObject({
      defaultTaxRateId: U1,
      email: 'ops@studio.io',
    });
  });

  it('rejects out-of-range settings with field-level messages', () => {
    const settings = (patch: Partial<typeof DEFAULT_WORKSPACE_SETTINGS>) => bad(workspaceSettingsSchema, { ...DEFAULT_WORKSPACE_SETTINGS, ...patch });
    expect(settings({ invoicePrefix: 'IN V' })).toEqual({ invoicePrefix: 'Letters and numbers only' });
    expect(settings({ invoicePrefix: 'ABCDEFGHI' }).invoicePrefix).toBe('Prefix must be 8 characters or fewer');
    expect(settings({ nextInvoiceNumber: 0 })).toEqual({ nextInvoiceNumber: 'Must be at least 1' });
    expect(settings({ invoiceNumberPadding: 9 }).invoiceNumberPadding).toBeDefined();
    expect(settings({ defaultPaymentTermsDays: 366 })).toEqual({ defaultPaymentTermsDays: 'At most 365 days' });
    expect(settings({ defaultPaymentTermsDays: -1 })).toEqual({ defaultPaymentTermsDays: 'Cannot be negative' });
    expect(settings({ fiscalYearStartMonth: 13 }).fiscalYearStartMonth).toBeDefined();
    expect(settings({ fiscalYearStartMonth: 0 }).fiscalYearStartMonth).toBeDefined();
    expect(settings({ defaultTaxRateId: 'x' }).defaultTaxRateId).toBe('Invalid id');
    expect(settings({ email: 'bad' }).email).toBeDefined();
    expect(settings({ phone: 'x'.repeat(41) }).phone).toBe('Phone must be 40 characters or fewer');
  });

  it('createWorkspaceSchema validates currency and slug', () => {
    expect(ok(createWorkspaceSchema, { name: 'Northlight', currency: 'USD' })).toEqual({ name: 'Northlight', currency: 'USD' });
    expect(ok(createWorkspaceSchema, { name: 'Northlight', currency: 'EUR', slug: ' My-Studio ' }).slug).toBe('my-studio');
    expect(bad(createWorkspaceSchema, { name: 'Northlight', currency: 'XXX' }).currency).toBeDefined();
    expect(bad(createWorkspaceSchema, { name: 'Northlight', currency: 'USD', slug: 'my studio' })).toEqual({
      slug: 'Use lowercase letters, numbers and hyphens',
    });
    expect(bad(createWorkspaceSchema, { name: 'Northlight', currency: 'USD', slug: '-bad-' }).slug).toBe('Use lowercase letters, numbers and hyphens');
    expect(bad(createWorkspaceSchema, { name: 'Northlight', currency: 'USD', slug: 'a' }).slug).toBe('Slug must be at least 2 characters');
    expect(bad(createWorkspaceSchema, { name: '', currency: 'USD' })).toEqual({ name: 'Workspace name is required' });
  });

  it('updateWorkspaceSchema accepts partial settings', () => {
    expect(ok(updateWorkspaceSchema, {})).toEqual({});
    expect(ok(updateWorkspaceSchema, { settings: { requireInvoiceApproval: false } })).toEqual({ settings: { requireInvoiceApproval: false } });
    expect(bad(updateWorkspaceSchema, { settings: { nextInvoiceNumber: 0 } })['settings.nextInvoiceNumber']).toBe('Must be at least 1');
  });

  it('member schemas', () => {
    expect(ok(inviteMemberSchema, { email: 'X@Y.io', role: 'admin' })).toEqual({ email: 'x@y.io', role: 'admin' });
    expect(bad(inviteMemberSchema, { email: 'x@y.io', role: 'owner' }).role).toBeDefined();
    expect(bad(inviteMemberSchema, { email: 'x@y.io', role: 'ceo' }).role).toBeDefined();
    expect(ok(updateMemberRoleSchema, { role: 'owner' })).toEqual({ role: 'owner' });
  });
});

describe('list & range queries', () => {
  it('listQuerySchema coerces page and pageSize from strings with fallbacks', () => {
    expect(ok(listQuerySchema, {})).toEqual({ page: 1, pageSize: 25 });
    expect(ok(listQuerySchema, { page: '3', pageSize: '50' })).toMatchObject({ page: 3, pageSize: 50 });
    expect(ok(listQuerySchema, { page: 2, pageSize: 200 })).toMatchObject({ page: 2, pageSize: 200 });
    expect(ok(listQuerySchema, { page: 'abc', pageSize: 'xyz' })).toMatchObject({ page: 1, pageSize: 25 });
    expect(ok(listQuerySchema, { page: '0', pageSize: '0' })).toMatchObject({ page: 1, pageSize: 25 });
    expect(ok(listQuerySchema, { page: '', pageSize: '' })).toMatchObject({ page: 1, pageSize: 25 });
    expect(ok(listQuerySchema, { pageSize: '500' }).pageSize).toBe(25);
    expect(ok(listQuerySchema, { page: '2.5' }).page).toBe(1);
    expect(ok(listQuerySchema, { page: '100000' }).page).toBe(100000);
    expect(ok(listQuerySchema, { page: '100001' }).page).toBe(1);
  });

  it('listQuerySchema trims q and validates dir', () => {
    expect(ok(listQuerySchema, { q: '  acme ', sort: 'name', dir: 'desc' })).toMatchObject({ q: 'acme', sort: 'name', dir: 'desc' });
    expect(bad(listQuerySchema, { dir: 'up' }).dir).toBeDefined();
    expect(bad(listQuerySchema, { q: 'x'.repeat(121) }).q).toBeDefined();
  });

  it('status filters fall back on unknown values', () => {
    expect(ok(invoiceStatusFilterSchema, 'overdue')).toBe('overdue');
    expect(ok(invoiceStatusFilterSchema, 'open')).toBe('open');
    expect(bad(invoiceStatusFilterSchema, 'bogus')._).toBeDefined();
    expect(ok(invoiceListQuerySchema, { status: 'bogus' }).status).toBe('all');
    expect(ok(invoiceListQuerySchema, {}).status).toBe('all');
    expect(ok(invoiceListQuerySchema, { status: 'overdue', clientId: U1, from: '2024-01-01' })).toMatchObject({ status: 'overdue', clientId: U1 });
    expect(ok(clientListQuerySchema, { status: 'bogus' }).status).toBe('active');
    expect(ok(clientListQuerySchema, { status: 'all' }).status).toBe('all');
    expect(ok(projectListQuerySchema, { status: 'bogus' }).status).toBe('all');
    expect(ok(projectListQuerySchema, { status: 'on_hold' }).status).toBe('on_hold');
    expect(ok(expenseListQuerySchema, { status: 'unpaid' }).status).toBe('unpaid');
    expect(ok(expenseListQuerySchema, { status: 'nope' }).status).toBe('all');
    expect(ok(approvalListQuerySchema, {}).status).toBe('pending');
    expect(ok(approvalListQuerySchema, { status: 'weird' }).status).toBe('pending');
    expect(ok(dashboardQuerySchema, {}).range).toBe('month');
    expect(ok(dashboardQuerySchema, { range: 'decade' }).range).toBe('month');
    expect(ok(dashboardQuerySchema, { range: 'year' }).range).toBe('year');
  });

  it('coerces booleans from query strings', () => {
    expect(ok(timeEntryListQuerySchema, { billable: 'true', uninvoiced: '1' })).toMatchObject({ billable: true, uninvoiced: true });
    expect(ok(timeEntryListQuerySchema, { billable: 'false', uninvoiced: '0' })).toMatchObject({ billable: false, uninvoiced: false });
    expect(ok(timeEntryListQuerySchema, { billable: 'yes' }).billable).toBe(false);
    expect(ok(timeEntryListQuerySchema, {}).billable).toBeUndefined();
    expect(bad(timeEntryListQuerySchema, { projectId: 'x' }).projectId).toBe('Invalid id');
  });

  it('dateRangeSchema requires from <= to', () => {
    expect(ok(dateRangeSchema, {})).toEqual({});
    expect(ok(dateRangeSchema, { from: '2024-01-01', to: '2024-01-01' })).toEqual({ from: '2024-01-01', to: '2024-01-01' });
    expect(ok(dateRangeSchema, { from: '2024-01-01' })).toEqual({ from: '2024-01-01' });
    expect(bad(dateRangeSchema, { from: '2024-02-01', to: '2024-01-01' })).toEqual({ to: '"From" must be before "to"' });
    expect(bad(dateRangeSchema, { from: 'x' }).from).toBeDefined();
    expect(ok(asOfSchema, { asOf: '2024-06-30' })).toEqual({ asOf: '2024-06-30' });
  });

  it('profit/loss query combines range with compare', () => {
    expect(ok(profitLossQuerySchema, { from: '2024-01-01', to: '2024-03-31', compare: 'previous' })).toEqual({
      from: '2024-01-01',
      to: '2024-03-31',
      compare: 'previous',
    });
    expect(ok(profitLossQuerySchema, {}).compare).toBe('none');
    expect(ok(profitLossQuerySchema, { compare: 'bogus' }).compare).toBe('none');
    expect(bad(profitLossQuerySchema, { from: '2024-02-01', to: '2024-01-01' }).to).toBeDefined();
  });

  it('month and search queries', () => {
    expect(ok(monthQuerySchema, { month: '2024-12' })).toEqual({ month: '2024-12' });
    expect(ok(monthQuerySchema, {})).toEqual({});
    expect(bad(monthQuerySchema, { month: '2024-13' })).toEqual({ month: 'Month must be YYYY-MM' });
    expect(bad(monthQuerySchema, { month: '2024-1' }).month).toBeDefined();
    expect(ok(searchQuerySchema, { q: ' inv ' })).toEqual({ q: 'inv' });
    expect(bad(searchQuerySchema, { q: '  ' }).q).toBeDefined();
  });

  it('other list queries validate their filters', () => {
    expect(ok(journalListQuerySchema, { sourceType: 'reversal', accountId: U1 })).toMatchObject({ sourceType: 'reversal', accountId: U1 });
    expect(bad(journalListQuerySchema, { sourceType: 'magic' }).sourceType).toBeDefined();
    expect(ok(paymentListQuerySchema, { method: 'card' }).method).toBe('card');
    expect(bad(paymentListQuerySchema, { method: 'paypal' }).method).toBeDefined();
  });
});

describe('clientInputSchema', () => {
  it('applies defaults for everything but the name', () => {
    expect(ok(clientInputSchema, { name: ' Acme ' })).toEqual({
      name: 'Acme',
      company: '',
      email: '',
      phone: '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      region: '',
      postalCode: '',
      country: '',
      taxId: '',
      paymentTermsDays: 30,
      notes: '',
      status: 'active',
    });
  });

  it('normalises nulls and email casing', () => {
    expect(ok(clientInputSchema, { name: 'Acme', company: null, email: 'Billing@Acme.COM', status: 'archived' })).toMatchObject({
      company: '',
      email: 'billing@acme.com',
      status: 'archived',
    });
  });

  it('rejects bad values', () => {
    expect(bad(clientInputSchema, { name: '  ' })).toEqual({ name: 'Client name is required' });
    expect(bad(clientInputSchema, { name: 'A', paymentTermsDays: 400 })).toEqual({ paymentTermsDays: 'At most 365 days' });
    expect(bad(clientInputSchema, { name: 'A', paymentTermsDays: -1 }).paymentTermsDays).toBe('Cannot be negative');
    expect(bad(clientInputSchema, { name: 'A', email: 'bad' }).email).toBeDefined();
    expect(bad(clientInputSchema, { name: 'A', status: 'deleted' }).status).toBeDefined();
    expect(bad(clientInputSchema, { name: 'A', notes: 'x'.repeat(2001) }).notes).toBe('Notes must be 2000 characters or fewer');
  });
});

describe('projectInputSchema', () => {
  const base = { clientId: U1, name: 'Website' };

  it('applies defaults', () => {
    expect(ok(projectInputSchema, base)).toEqual({
      clientId: U1,
      name: 'Website',
      code: '',
      description: '',
      status: 'active',
      billingType: 'hourly',
      hourlyRateCents: 0,
      budgetCents: 0,
      startDate: null,
      endDate: null,
    });
  });

  it('upper-cases the code and validates its characters', () => {
    expect(ok(projectInputSchema, { ...base, code: ' web-1 ' }).code).toBe('WEB-1');
    expect(bad(projectInputSchema, { ...base, code: 'web 1' })).toEqual({ code: 'Letters, numbers and hyphens only' });
    expect(bad(projectInputSchema, { ...base, code: 'ABCDEFGHIJKLM' }).code).toBe('Code must be 12 characters or fewer');
  });

  it('enforces the date ordering refinement', () => {
    expect(ok(projectInputSchema, { ...base, startDate: '2024-01-01', endDate: '2024-01-01' })).toMatchObject({ startDate: '2024-01-01', endDate: '2024-01-01' });
    expect(ok(projectInputSchema, { ...base, startDate: '', endDate: '2024-01-01' })).toMatchObject({ startDate: null, endDate: '2024-01-01' });
    expect(bad(projectInputSchema, { ...base, startDate: '2024-02-01', endDate: '2024-01-01' })).toEqual({ endDate: 'End date must be after the start date' });
    expect(bad(projectInputSchema, { ...base, startDate: '2024-02-30' }).startDate).toBe('Enter a valid date (YYYY-MM-DD)');
  });

  it('requires whole non-negative cents', () => {
    expect(bad(projectInputSchema, { ...base, hourlyRateCents: -1 })).toEqual({ hourlyRateCents: 'Amount cannot be negative' });
    expect(bad(projectInputSchema, { ...base, budgetCents: 10.5 })).toEqual({ budgetCents: 'Amounts must be whole cents' });
    expect(bad(projectInputSchema, { ...base, clientId: 'nope' })).toEqual({ clientId: 'Invalid id' });
    expect(bad(projectInputSchema, { ...base, status: 'paused' }).status).toBeDefined();
    expect(bad(projectInputSchema, { ...base, billingType: 'retainer' }).billingType).toBeDefined();
  });
});

describe('timeEntryInputSchema', () => {
  const base = { projectId: U1, date: '2024-06-03', minutes: 30 };

  it('accepts a valid entry with defaults', () => {
    expect(ok(timeEntryInputSchema, base)).toEqual({ projectId: U1, date: '2024-06-03', minutes: 30, description: '', billable: true });
    expect(ok(timeEntryInputSchema, { ...base, userId: U2, billable: false, description: ' work ' })).toMatchObject({ userId: U2, billable: false, description: 'work' });
  });

  it('bounds minutes to 1..1440 whole minutes', () => {
    expect(ok(timeEntryInputSchema, { ...base, minutes: 1 }).minutes).toBe(1);
    expect(ok(timeEntryInputSchema, { ...base, minutes: 1440 }).minutes).toBe(1440);
    expect(bad(timeEntryInputSchema, { ...base, minutes: 0 })).toEqual({ minutes: 'Log at least one minute' });
    expect(bad(timeEntryInputSchema, { ...base, minutes: 1441 })).toEqual({ minutes: 'A single entry cannot exceed 24 hours' });
    expect(bad(timeEntryInputSchema, { ...base, minutes: 30.5 }).minutes).toBeDefined();
    expect(bad(timeEntryInputSchema, { ...base, date: '2024-13-01' }).date).toBe('Enter a valid date (YYYY-MM-DD)');
  });
});

describe('taxRateInputSchema', () => {
  it('validates the rate and defaults isDefault', () => {
    expect(ok(taxRateInputSchema, { name: 'VAT', rateBp: 2000 })).toEqual({ name: 'VAT', rateBp: 2000, isDefault: false });
    expect(bad(taxRateInputSchema, { name: 'VAT', rateBp: 10001 })).toEqual({ rateBp: 'Cannot exceed 100%' });
    expect(bad(taxRateInputSchema, { name: '', rateBp: 0 })).toEqual({ name: 'Name is required' });
  });
});

describe('invoiceInputSchema', () => {
  const line = { description: 'Design', quantity: 2, unitPriceCents: 10000, accountId: U2 };
  const base = { clientId: U1, issueDate: '2024-06-01', dueDate: '2024-07-01', lines: [line] };

  it('accepts a valid invoice and fills defaults', () => {
    expect(ok(invoiceInputSchema, base)).toEqual({
      clientId: U1,
      projectId: null,
      issueDate: '2024-06-01',
      dueDate: '2024-07-01',
      discountBp: 0,
      notes: '',
      terms: '',
      poNumber: '',
      lines: [{ description: 'Design', quantity: 2, unitPriceCents: 10000, taxRateId: null, accountId: U2 }],
    });
    expect(ok(invoiceInputSchema, { ...base, projectId: U3, discountBp: 1000, lines: [{ ...line, id: U3, taxRateId: U1 }] })).toMatchObject({
      projectId: U3,
      discountBp: 1000,
      lines: [{ id: U3, taxRateId: U1 }],
    });
  });

  it('requires at least one line and at most 200', () => {
    expect(bad(invoiceInputSchema, { ...base, lines: [] })).toEqual({ lines: 'Add at least one line' });
    expect(bad(invoiceInputSchema, { ...base, lines: Array.from({ length: 201 }, () => line) }).lines).toBeDefined();
  });

  it('rejects a due date before the issue date but allows the same day', () => {
    expect(bad(invoiceInputSchema, { ...base, dueDate: '2024-05-31' })).toEqual({ dueDate: 'Due date cannot be before the issue date' });
    expect(ok(invoiceInputSchema, { ...base, dueDate: '2024-06-01' }).dueDate).toBe('2024-06-01');
  });

  it('validates quantities: positive, at most four decimals, including binary-awkward values', () => {
    for (const q of [1, 0.5, 1.25, 1.2345, 0.0001, 0.07, 1.11, 1.13, 999999.99]) {
      expect(ok(invoiceLineInputSchema, { ...line, quantity: q }).quantity).toBe(q);
    }
    expect(bad(invoiceLineInputSchema, { ...line, quantity: 0 })).toEqual({ quantity: 'Quantity must be greater than zero' });
    expect(bad(invoiceLineInputSchema, { ...line, quantity: -1 }).quantity).toBe('Quantity must be greater than zero');
    expect(bad(invoiceLineInputSchema, { ...line, quantity: 1.23456 })).toEqual({ quantity: 'At most four decimal places' });
    expect(bad(invoiceLineInputSchema, { ...line, quantity: 1.00001 }).quantity).toBe('At most four decimal places');
    expect(bad(invoiceLineInputSchema, { ...line, quantity: 1000001 }).quantity).toBeDefined();
    expect(bad(invoiceLineInputSchema, { ...line, quantity: '2' })).toEqual({ quantity: 'Enter a quantity' });
    expect(bad(invoiceInputSchema, { ...base, lines: [{ ...line, quantity: 0 }] })['lines.0.quantity']).toBe('Quantity must be greater than zero');
  });

  it('validates the remaining line fields', () => {
    expect(bad(invoiceLineInputSchema, { ...line, description: ' ' })).toEqual({ description: 'Description is required' });
    expect(bad(invoiceLineInputSchema, { ...line, unitPriceCents: 10.5 })).toEqual({ unitPriceCents: 'Amounts must be whole cents' });
    expect(ok(invoiceLineInputSchema, { ...line, unitPriceCents: -500 }).unitPriceCents).toBe(-500);
    expect(ok(invoiceLineInputSchema, { ...line, unitPriceCents: 0 }).unitPriceCents).toBe(0);
    expect(bad(invoiceLineInputSchema, { ...line, accountId: 'x' })).toEqual({ accountId: 'Invalid id' });
    expect(bad(invoiceLineInputSchema, { ...line, taxRateId: 'x' }).taxRateId).toBe('Invalid id');
    expect(bad(invoiceInputSchema, { ...base, discountBp: 10001 }).discountBp).toBe('Cannot exceed 100%');
    expect(bad(invoiceInputSchema, { ...base, poNumber: 'x'.repeat(61) }).poNumber).toBe('PO number must be 60 characters or fewer');
  });

  it('invoiceFromTimeSchema needs entries and defaults groupBy', () => {
    expect(ok(invoiceFromTimeSchema, { clientId: U1, entryIds: [U2] })).toEqual({ clientId: U1, projectId: null, entryIds: [U2], groupBy: 'entry' });
    expect(bad(invoiceFromTimeSchema, { clientId: U1, entryIds: [] })).toEqual({ entryIds: 'Select at least one time entry' });
    expect(bad(invoiceFromTimeSchema, { clientId: U1, entryIds: [U2], groupBy: 'week' }).groupBy).toBeDefined();
  });

  it('decision, rejection and void bodies', () => {
    expect(ok(approvalDecisionSchema, {})).toEqual({ comment: '' });
    expect(ok(rejectionSchema, { comment: 'Wrong client' })).toEqual({ comment: 'Wrong client' });
    expect(bad(rejectionSchema, { comment: '' })).toEqual({ comment: 'A reason is required' });
    expect(bad(voidInvoiceSchema, {})).toEqual({ reason: 'A reason is required' });
    expect(ok(voidInvoiceSchema, { reason: 'Duplicate' })).toEqual({ reason: 'Duplicate' });
  });
});

describe('recordPaymentSchema', () => {
  const base = { date: '2024-06-15', amountCents: 5000, method: 'bank_transfer' };

  it('accepts a payment and defaults the free-text fields', () => {
    expect(ok(recordPaymentSchema, base)).toEqual({ ...base, reference: '', note: '' });
    expect(ok(recordPaymentSchema, { ...base, method: 'cheque', reference: ' 42 ' })).toMatchObject({ method: 'cheque', reference: '42' });
  });

  it('requires a positive whole-cent amount and a known method', () => {
    expect(bad(recordPaymentSchema, { ...base, amountCents: 0 })).toEqual({ amountCents: 'Amount must be greater than zero' });
    expect(bad(recordPaymentSchema, { ...base, amountCents: -5 }).amountCents).toBe('Amount must be greater than zero');
    expect(bad(recordPaymentSchema, { ...base, amountCents: 10.5 }).amountCents).toBe('Amounts must be whole cents');
    expect(bad(recordPaymentSchema, { ...base, amountCents: '50' }).amountCents).toBe('Enter an amount');
    expect(bad(recordPaymentSchema, { ...base, method: 'paypal' }).method).toBeDefined();
    expect(bad(recordPaymentSchema, { ...base, date: '2024-06-31' }).date).toBeDefined();
  });

  it('payExpenseSchema is the same shape without an amount', () => {
    expect(ok(payExpenseSchema, { date: '2024-06-15', method: 'card' })).toEqual({ date: '2024-06-15', method: 'card', reference: '' });
    expect(bad(payExpenseSchema, { date: '2024-06-15' }).method).toBeDefined();
  });
});

describe('expenseInputSchema', () => {
  const base = { vendor: 'Adobe', description: 'Creative Cloud', date: '2024-06-01', accountId: U1, amountCents: 5000 };

  it('accepts a valid expense with defaults', () => {
    expect(ok(expenseInputSchema, base)).toEqual({
      ...base,
      dueDate: null,
      taxRateId: null,
      clientId: null,
      projectId: null,
      billable: false,
      reference: '',
      notes: '',
    });
    expect(ok(expenseInputSchema, { ...base, dueDate: '', taxRateId: U2 })).toMatchObject({ dueDate: null, taxRateId: U2 });
  });

  it('requires a client when billable', () => {
    expect(bad(expenseInputSchema, { ...base, billable: true })).toEqual({ clientId: 'Billable expenses need a client' });
    expect(ok(expenseInputSchema, { ...base, billable: true, clientId: U2 })).toMatchObject({ billable: true, clientId: U2 });
    expect(ok(expenseInputSchema, { ...base, billable: false, clientId: null }).billable).toBe(false);
  });

  it('validates amount and required text', () => {
    expect(bad(expenseInputSchema, { ...base, amountCents: 0 })).toEqual({ amountCents: 'Amount must be greater than zero' });
    expect(bad(expenseInputSchema, { ...base, vendor: '' })).toEqual({ vendor: 'Vendor is required' });
    expect(bad(expenseInputSchema, { ...base, description: ' ' })).toEqual({ description: 'Description is required' });
    expect(bad(expenseInputSchema, { ...base, dueDate: 'soon' }).dueDate).toBeDefined();
  });
});

describe('ledger schemas', () => {
  it('accountInputSchema validates the code', () => {
    expect(ok(accountInputSchema, { code: ' 1200 ', name: 'AR', type: 'asset' })).toEqual({
      code: '1200',
      name: 'AR',
      type: 'asset',
      parentId: null,
      description: '',
      archived: false,
    });
    expect(bad(accountInputSchema, { code: '12', name: 'AR', type: 'asset' })).toEqual({ code: 'Code must be 3–6 digits' });
    expect(bad(accountInputSchema, { code: '1234567', name: 'AR', type: 'asset' }).code).toBe('Code must be 3–6 digits');
    expect(bad(accountInputSchema, { code: '12a4', name: 'AR', type: 'asset' })).toEqual({ code: 'Codes are numeric' });
    expect(bad(accountInputSchema, { code: '1200', name: '', type: 'asset' })).toEqual({ name: 'Account name is required' });
    expect(bad(accountInputSchema, { code: '1200', name: 'AR', type: 'income' }).type).toBeDefined();
    expect(ok(accountInputSchema, { code: '1200', name: 'AR', type: 'asset', parentId: U1, archived: true })).toMatchObject({ parentId: U1, archived: true });
  });

  it('manualJournalEntrySchema requires two balanced lines', () => {
    const entry = {
      date: '2024-06-01',
      memo: 'Opening balance',
      lines: [
        { accountId: U1, debitCents: 1000 },
        { accountId: U2, creditCents: 1000 },
      ],
    };
    expect(ok(manualJournalEntrySchema, entry)).toEqual({
      date: '2024-06-01',
      memo: 'Opening balance',
      lines: [
        { accountId: U1, debitCents: 1000, creditCents: 0, description: '' },
        { accountId: U2, debitCents: 0, creditCents: 1000, description: '' },
      ],
    });
    expect(
      bad(manualJournalEntrySchema, {
        ...entry,
        lines: [
          { accountId: U1, debitCents: 1000 },
          { accountId: U2, creditCents: 999 },
        ],
      }),
    ).toEqual({ lines: 'Debits must equal credits' });
    expect(bad(manualJournalEntrySchema, { ...entry, lines: [{ accountId: U1, debitCents: 1000 }] }).lines).toBe('An entry needs at least two lines');
    expect(bad(manualJournalEntrySchema, { ...entry, memo: '' })).toEqual({ memo: 'Memo is required' });
    expect(
      ok(manualJournalEntrySchema, {
        ...entry,
        lines: [
          { accountId: U1, debitCents: 600 },
          { accountId: U3, debitCents: 400 },
          { accountId: U2, creditCents: 1000 },
        ],
      }).lines,
    ).toHaveLength(3);
  });

  it('each journal line is either a debit or a credit, never both or neither', () => {
    const entry = (line: Record<string, unknown>) => ({
      date: '2024-06-01',
      memo: 'x',
      lines: [line, { accountId: U2, creditCents: 10 }],
    });
    expect(bad(manualJournalEntrySchema, entry({ accountId: U1, debitCents: 10, creditCents: 10 }))['lines.0.creditCents']).toBe('A line is either a debit or a credit');
    expect(bad(manualJournalEntrySchema, entry({ accountId: U1 }))['lines.0.debitCents']).toBe('Enter an amount');
    expect(bad(manualJournalEntrySchema, entry({ accountId: U1, debitCents: -5 }))['lines.0.debitCents']).toBe('Amount cannot be negative');
    expect(bad(manualJournalEntrySchema, entry({ accountId: 'x', debitCents: 10 }))['lines.0.accountId']).toBe('Invalid id');
  });

  it('reverseEntrySchema is fully optional', () => {
    expect(ok(reverseEntrySchema, {})).toEqual({ memo: '' });
    expect(ok(reverseEntrySchema, { date: '2024-06-02', memo: ' undo ' })).toEqual({ date: '2024-06-02', memo: 'undo' });
    expect(bad(reverseEntrySchema, { date: 'x' }).date).toBeDefined();
  });
});
