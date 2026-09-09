import { z } from 'zod';
import { CURRENCY_CODES, MAX_PAGE_SIZE, MIN_PASSWORD_LENGTH } from './constants';
import { isIsoDate } from './dates';

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export const isoDateSchema = z
  .string()
  .refine((v) => isIsoDate(v), { message: 'Enter a valid date (YYYY-MM-DD)' });

export const optionalIsoDateSchema = z.preprocess(
  (v) => (v === '' || v === undefined ? null : v),
  isoDateSchema.nullable(),
);

export const centsSchema = z
  .number({ invalid_type_error: 'Enter an amount' })
  .int('Amounts must be whole cents')
  .safe();

export const positiveCentsSchema = centsSchema.positive('Amount must be greater than zero');
export const nonNegativeCentsSchema = centsSchema.min(0, 'Amount cannot be negative');

export const bpSchema = z
  .number()
  .int()
  .min(0, 'Cannot be negative')
  .max(10_000, 'Cannot exceed 100%');

export const uuidSchema = z.string().uuid('Invalid id');

export const trimmedString = (max: number, label = 'This field') =>
  z
    .string({ required_error: `${label} is required` })
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`);

export const requiredString = (max: number, label = 'This field') =>
  trimmedString(max, label).min(1, `${label} is required`);

export const optionalString = (max: number, label?: string) =>
  z.preprocess((v) => (v == null ? '' : v), trimmedString(max, label)).default('');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address')
  .max(254);

export const roleSchema = z.enum(['owner', 'admin', 'accountant', 'member']);
export const paymentMethodSchema = z.enum(['bank_transfer', 'card', 'cash', 'cheque', 'other']);
export const accountTypeSchema = z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']);
export const projectStatusSchema = z.enum(['active', 'on_hold', 'completed', 'archived']);
export const clientStatusSchema = z.enum(['active', 'archived']);
export const billingTypeSchema = z.enum(['hourly', 'fixed']);
export const invoiceStatusFilterSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'partially_paid',
  'paid',
  'overdue',
  'void',
  'open',
  'all',
]);
export const expenseStatusSchema = z.enum([
  'draft',
  'pending_approval',
  'approved',
  'paid',
  'rejected',
]);

const boolFromQuery = z.preprocess((v) => {
  if (typeof v === 'string') return v === 'true' || v === '1';
  return v;
}, z.boolean());

const intFromQuery = (min: number, max: number, fallback: number) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' && v !== '' ? Number(v) : v),
      z.number().int().min(min).max(max),
    )
    .catch(fallback);

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const passwordSchema = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, 'Password is too long');

export const registerSchema = z.object({
  name: requiredString(80, 'Name'),
  email: emailSchema,
  password: passwordSchema,
  inviteToken: z.string().trim().optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const updateProfileSchema = z.object({
  name: requiredString(80, 'Name'),
  email: emailSchema,
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

// ---------------------------------------------------------------------------
// Workspaces
// ---------------------------------------------------------------------------

export const workspaceSettingsSchema = z.object({
  invoicePrefix: z
    .string()
    .trim()
    .max(8, 'Prefix must be 8 characters or fewer')
    .regex(/^[A-Za-z0-9]*$/, 'Letters and numbers only'),
  nextInvoiceNumber: z.number().int().min(1, 'Must be at least 1').max(99_999_999),
  invoiceNumberPadding: z.number().int().min(0).max(8),
  defaultPaymentTermsDays: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .max(365, 'At most 365 days'),
  defaultTaxRateId: uuidSchema.nullable(),
  requireInvoiceApproval: z.boolean(),
  requireExpenseApproval: z.boolean(),
  fiscalYearStartMonth: z.number().int().min(1).max(12),
  invoiceFooter: trimmedString(500, 'Footer'),
  address: trimmedString(300, 'Address'),
  email: z.union([z.literal(''), emailSchema]),
  phone: trimmedString(40, 'Phone'),
});
export type WorkspaceSettingsInput = z.infer<typeof workspaceSettingsSchema>;

export const createWorkspaceSchema = z.object({
  name: requiredString(80, 'Workspace name'),
  currency: z.enum(CURRENCY_CODES as [string, ...string[]]),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2, 'Slug must be at least 2 characters')
    .max(48)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens')
    .optional(),
});
export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const updateWorkspaceSchema = z.object({
  name: requiredString(80, 'Workspace name').optional(),
  currency: z.enum(CURRENCY_CODES as [string, ...string[]]).optional(),
  settings: workspaceSettingsSchema.partial().optional(),
});
export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: roleSchema.exclude(['owner']),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

export const updateMemberRoleSchema = z.object({ role: roleSchema });
export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

// ---------------------------------------------------------------------------
// Listing & ranges
// ---------------------------------------------------------------------------

export const listQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  sort: z.string().trim().max(40).optional(),
  dir: z.enum(['asc', 'desc']).optional(),
  page: intFromQuery(1, 100_000, 1),
  pageSize: intFromQuery(1, MAX_PAGE_SIZE, 25),
});
export type ListQuery = z.infer<typeof listQuerySchema>;

export const dateRangeSchema = z
  .object({
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
  })
  .refine((v) => !v.from || !v.to || v.from <= v.to, {
    message: '"From" must be before "to"',
    path: ['to'],
  });
export type DateRangeQuery = z.infer<typeof dateRangeSchema>;

export const asOfSchema = z.object({ asOf: isoDateSchema.optional() });

export const monthQuerySchema = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM')
    .optional(),
});

export const dashboardQuerySchema = z.object({
  range: z.enum(['month', 'quarter', 'year']).catch('month'),
});

export const searchQuerySchema = z.object({ q: z.string().trim().min(1).max(120) });

// ---------------------------------------------------------------------------
// Clients / projects / time
// ---------------------------------------------------------------------------

export const clientInputSchema = z.object({
  name: requiredString(120, 'Client name'),
  company: optionalString(120, 'Company'),
  email: z.union([z.literal(''), emailSchema]).default(''),
  phone: optionalString(40, 'Phone'),
  addressLine1: optionalString(120, 'Address'),
  addressLine2: optionalString(120, 'Address'),
  city: optionalString(80, 'City'),
  region: optionalString(80, 'Region'),
  postalCode: optionalString(20, 'Postal code'),
  country: optionalString(80, 'Country'),
  taxId: optionalString(40, 'Tax ID'),
  paymentTermsDays: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .max(365, 'At most 365 days')
    .default(30),
  notes: optionalString(2000, 'Notes'),
  status: clientStatusSchema.default('active'),
});
export type ClientInput = z.infer<typeof clientInputSchema>;

export const clientListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'archived', 'all']).catch('active'),
});

export const projectInputSchema = z
  .object({
    clientId: uuidSchema,
    name: requiredString(120, 'Project name'),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(12, 'Code must be 12 characters or fewer')
      .regex(/^[A-Z0-9-]*$/, 'Letters, numbers and hyphens only')
      .default(''),
    description: optionalString(2000, 'Description'),
    status: projectStatusSchema.default('active'),
    billingType: billingTypeSchema.default('hourly'),
    hourlyRateCents: nonNegativeCentsSchema.default(0),
    budgetCents: nonNegativeCentsSchema.default(0),
    startDate: optionalIsoDateSchema.default(null),
    endDate: optionalIsoDateSchema.default(null),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: 'End date must be after the start date',
    path: ['endDate'],
  });
export type ProjectInput = z.infer<typeof projectInputSchema>;

export const projectListQuerySchema = listQuerySchema.extend({
  status: z.enum(['active', 'on_hold', 'completed', 'archived', 'all']).catch('all'),
  clientId: uuidSchema.optional(),
});

export const timeEntryInputSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema.optional(),
  date: isoDateSchema,
  minutes: z
    .number()
    .int()
    .min(1, 'Log at least one minute')
    .max(24 * 60, 'A single entry cannot exceed 24 hours'),
  description: optionalString(500, 'Description'),
  billable: z.boolean().default(true),
});
export type TimeEntryInput = z.infer<typeof timeEntryInputSchema>;

export const timeEntryListQuerySchema = listQuerySchema.extend({
  projectId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  userId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  billable: boolFromQuery.optional(),
  uninvoiced: boolFromQuery.optional(),
});

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------

export const taxRateInputSchema = z.object({
  name: requiredString(60, 'Name'),
  rateBp: bpSchema,
  isDefault: z.boolean().default(false),
});
export type TaxRateInput = z.infer<typeof taxRateInputSchema>;

export const invoiceLineInputSchema = z.object({
  id: uuidSchema.optional(),
  description: requiredString(500, 'Description'),
  quantity: z
    .number({ invalid_type_error: 'Enter a quantity' })
    .positive('Quantity must be greater than zero')
    .max(1_000_000)
    .refine((q) => Math.abs(q * 10_000 - Math.round(q * 10_000)) < 1e-6, {
      message: 'At most four decimal places',
    }),
  unitPriceCents: centsSchema,
  taxRateId: uuidSchema.nullable().default(null),
  accountId: uuidSchema,
});
export type InvoiceLineInput = z.infer<typeof invoiceLineInputSchema>;

export const invoiceInputSchema = z
  .object({
    clientId: uuidSchema,
    projectId: uuidSchema.nullable().default(null),
    issueDate: isoDateSchema,
    dueDate: isoDateSchema,
    discountBp: bpSchema.default(0),
    notes: optionalString(2000, 'Notes'),
    terms: optionalString(2000, 'Terms'),
    poNumber: optionalString(60, 'PO number'),
    lines: z.array(invoiceLineInputSchema).min(1, 'Add at least one line').max(200),
  })
  .refine((v) => v.issueDate <= v.dueDate, {
    message: 'Due date cannot be before the issue date',
    path: ['dueDate'],
  });
export type InvoiceInput = z.infer<typeof invoiceInputSchema>;

export const invoiceListQuerySchema = listQuerySchema.extend({
  status: invoiceStatusFilterSchema.catch('all'),
  clientId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const invoiceFromTimeSchema = z.object({
  clientId: uuidSchema,
  projectId: uuidSchema.nullable().default(null),
  entryIds: z.array(uuidSchema).min(1, 'Select at least one time entry'),
  groupBy: z.enum(['entry', 'day', 'project']).default('entry'),
  issueDate: isoDateSchema.optional(),
  dueDate: isoDateSchema.optional(),
});
export type InvoiceFromTimeInput = z.infer<typeof invoiceFromTimeSchema>;

export const approvalDecisionSchema = z.object({ comment: optionalString(1000, 'Comment') });
export const rejectionSchema = z.object({ comment: requiredString(1000, 'A reason') });
export const voidInvoiceSchema = z.object({ reason: requiredString(500, 'A reason') });

export const recordPaymentSchema = z.object({
  date: isoDateSchema,
  amountCents: positiveCentsSchema,
  method: paymentMethodSchema,
  reference: optionalString(80, 'Reference'),
  note: optionalString(500, 'Note'),
});
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const paymentListQuerySchema = listQuerySchema.extend({
  clientId: uuidSchema.optional(),
  method: paymentMethodSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export const expenseInputSchema = z
  .object({
    vendor: requiredString(120, 'Vendor'),
    description: requiredString(500, 'Description'),
    date: isoDateSchema,
    dueDate: optionalIsoDateSchema.default(null),
    accountId: uuidSchema,
    amountCents: positiveCentsSchema,
    taxRateId: uuidSchema.nullable().default(null),
    clientId: uuidSchema.nullable().default(null),
    projectId: uuidSchema.nullable().default(null),
    billable: z.boolean().default(false),
    reference: optionalString(80, 'Reference'),
    notes: optionalString(2000, 'Notes'),
  })
  .refine((v) => !v.billable || v.clientId, {
    message: 'Billable expenses need a client',
    path: ['clientId'],
  });
export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export const expenseListQuerySchema = listQuerySchema.extend({
  status: z
    .enum(['draft', 'pending_approval', 'approved', 'paid', 'rejected', 'unpaid', 'all'])
    .catch('all'),
  accountId: uuidSchema.optional(),
  clientId: uuidSchema.optional(),
  projectId: uuidSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const payExpenseSchema = z.object({
  date: isoDateSchema,
  method: paymentMethodSchema,
  reference: optionalString(80, 'Reference'),
});
export type PayExpenseInput = z.infer<typeof payExpenseSchema>;

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export const accountInputSchema = z.object({
  code: z
    .string()
    .trim()
    .min(3, 'Code must be 3–6 digits')
    .max(6, 'Code must be 3–6 digits')
    .regex(/^\d+$/, 'Codes are numeric'),
  name: requiredString(80, 'Account name'),
  type: accountTypeSchema,
  parentId: uuidSchema.nullable().default(null),
  description: optionalString(500, 'Description'),
  archived: z.boolean().default(false),
});
export type AccountInput = z.infer<typeof accountInputSchema>;

export const journalLineInputSchema = z
  .object({
    accountId: uuidSchema,
    debitCents: nonNegativeCentsSchema.default(0),
    creditCents: nonNegativeCentsSchema.default(0),
    description: optionalString(200, 'Description'),
  })
  .refine((l) => l.debitCents === 0 || l.creditCents === 0, {
    message: 'A line is either a debit or a credit',
    path: ['creditCents'],
  })
  .refine((l) => l.debitCents > 0 || l.creditCents > 0, {
    message: 'Enter an amount',
    path: ['debitCents'],
  });
export type JournalLineInput = z.infer<typeof journalLineInputSchema>;

export const manualJournalEntrySchema = z
  .object({
    date: isoDateSchema,
    memo: requiredString(200, 'Memo'),
    lines: z.array(journalLineInputSchema).min(2, 'An entry needs at least two lines').max(100),
  })
  .refine(
    (e) =>
      e.lines.reduce((s, l) => s + l.debitCents, 0) ===
      e.lines.reduce((s, l) => s + l.creditCents, 0),
    { message: 'Debits must equal credits', path: ['lines'] },
  );
export type ManualJournalEntryInput = z.infer<typeof manualJournalEntrySchema>;

export const journalListQuerySchema = listQuerySchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
  accountId: uuidSchema.optional(),
  sourceType: z
    .enum(['invoice', 'payment', 'expense', 'expense_payment', 'manual', 'reversal'])
    .optional(),
});

export const reverseEntrySchema = z.object({
  date: isoDateSchema.optional(),
  memo: optionalString(200, 'Memo'),
});

export const registerQuerySchema = listQuerySchema.extend({
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
});

export const profitLossQuerySchema = dateRangeSchema.and(
  z.object({ compare: z.enum(['previous', 'none']).catch('none') }),
);

// ---------------------------------------------------------------------------
// Approvals / notifications
// ---------------------------------------------------------------------------

export const approvalListQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'all']).catch('pending'),
});

export const notificationListQuerySchema = listQuerySchema.extend({
  unread: boolFromQuery.optional(),
});
