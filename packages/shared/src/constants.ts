import type {
  AccountType,
  AgingBucketKey,
  ApprovalStatus,
  DerivedInvoiceStatus,
  ExpenseStatus,
  NotificationKind,
  PaymentMethod,
  ProjectStatus,
  Role,
  SystemAccountKey,
  WorkspaceSettings,
} from './types';

export type Tone = 'neutral' | 'info' | 'positive' | 'negative' | 'warning' | 'muted';

export interface LabeledOption<T extends string> {
  value: T;
  label: string;
  tone: Tone;
  description?: string;
}

export const ROLES: LabeledOption<Role>[] = [
  { value: 'owner', label: 'Owner', tone: 'info', description: 'Full control, including billing and deletion.' },
  { value: 'admin', label: 'Admin', tone: 'info', description: 'Manage members, settings and all records.' },
  { value: 'accountant', label: 'Accountant', tone: 'positive', description: 'Approve, post to the ledger and run reports.' },
  { value: 'member', label: 'Member', tone: 'neutral', description: 'Log time, draft invoices and expenses.' },
];

export const INVOICE_STATUSES: LabeledOption<DerivedInvoiceStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'muted' },
  { value: 'pending_approval', label: 'Pending approval', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'info' },
  { value: 'sent', label: 'Sent', tone: 'info' },
  { value: 'partially_paid', label: 'Partially paid', tone: 'warning' },
  { value: 'paid', label: 'Paid', tone: 'positive' },
  { value: 'overdue', label: 'Overdue', tone: 'negative' },
  { value: 'void', label: 'Void', tone: 'muted' },
];

export const EXPENSE_STATUSES: LabeledOption<ExpenseStatus>[] = [
  { value: 'draft', label: 'Draft', tone: 'muted' },
  { value: 'pending_approval', label: 'Pending approval', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'info' },
  { value: 'paid', label: 'Paid', tone: 'positive' },
  { value: 'rejected', label: 'Rejected', tone: 'negative' },
];

export const PROJECT_STATUSES: LabeledOption<ProjectStatus>[] = [
  { value: 'active', label: 'Active', tone: 'positive' },
  { value: 'on_hold', label: 'On hold', tone: 'warning' },
  { value: 'completed', label: 'Completed', tone: 'info' },
  { value: 'archived', label: 'Archived', tone: 'muted' },
];

export const APPROVAL_STATUSES: LabeledOption<ApprovalStatus>[] = [
  { value: 'pending', label: 'Pending', tone: 'warning' },
  { value: 'approved', label: 'Approved', tone: 'positive' },
  { value: 'rejected', label: 'Rejected', tone: 'negative' },
];

export const PAYMENT_METHODS: LabeledOption<PaymentMethod>[] = [
  { value: 'bank_transfer', label: 'Bank transfer', tone: 'neutral' },
  { value: 'card', label: 'Card', tone: 'neutral' },
  { value: 'cash', label: 'Cash', tone: 'neutral' },
  { value: 'cheque', label: 'Cheque', tone: 'neutral' },
  { value: 'other', label: 'Other', tone: 'neutral' },
];

export const ACCOUNT_TYPES: LabeledOption<AccountType>[] = [
  { value: 'asset', label: 'Asset', tone: 'info' },
  { value: 'liability', label: 'Liability', tone: 'warning' },
  { value: 'equity', label: 'Equity', tone: 'neutral' },
  { value: 'revenue', label: 'Revenue', tone: 'positive' },
  { value: 'expense', label: 'Expense', tone: 'negative' },
];

/** Accounts whose balance grows with debits. */
export const DEBIT_NORMAL_TYPES: ReadonlySet<AccountType> = new Set(['asset', 'expense']);

export const NOTIFICATION_KINDS: LabeledOption<NotificationKind>[] = [
  { value: 'approval_requested', label: 'Approval requested', tone: 'warning' },
  { value: 'approval_decided', label: 'Approval decided', tone: 'info' },
  { value: 'invoice_sent', label: 'Invoice sent', tone: 'info' },
  { value: 'payment_received', label: 'Payment received', tone: 'positive' },
  { value: 'invoice_overdue', label: 'Invoice overdue', tone: 'negative' },
  { value: 'member_joined', label: 'Member joined', tone: 'neutral' },
  { value: 'mention', label: 'Mention', tone: 'neutral' },
  { value: 'system', label: 'System', tone: 'muted' },
];

export const AGING_BUCKETS: Array<{ key: AgingBucketKey; label: string; minDays: number; maxDays: number | null }> = [
  { key: 'current', label: 'Current', minDays: -Infinity, maxDays: 0 },
  { key: 'd1_30', label: '1–30 days', minDays: 1, maxDays: 30 },
  { key: 'd31_60', label: '31–60 days', minDays: 31, maxDays: 60 },
  { key: 'd61_90', label: '61–90 days', minDays: 61, maxDays: 90 },
  { key: 'd90_plus', label: '90+ days', minDays: 91, maxDays: null },
];

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£', decimals: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'CA$', decimals: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimals: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', decimals: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimals: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', decimals: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', decimals: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', decimals: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimals: 0 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', decimals: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimals: 2 },
];

export const CURRENCY_CODES = CURRENCIES.map((c) => c.code);

export function currencyInfo(code: string): CurrencyInfo {
  return CURRENCIES.find((c) => c.code === code) ?? { code, name: code, symbol: code, decimals: 2 };
}

export interface SystemAccountDefinition {
  key: SystemAccountKey;
  code: string;
  name: string;
  type: AccountType;
  description: string;
}

export const SYSTEM_ACCOUNTS: SystemAccountDefinition[] = [
  { key: 'cash', code: '1000', name: 'Operating Bank Account', type: 'asset', description: 'Money received and paid out.' },
  { key: 'accounts_receivable', code: '1200', name: 'Accounts Receivable', type: 'asset', description: 'Invoices issued but not yet paid.' },
  { key: 'input_tax', code: '1300', name: 'Input Tax Receivable', type: 'asset', description: 'Tax paid on expenses, recoverable.' },
  { key: 'accounts_payable', code: '2000', name: 'Accounts Payable', type: 'liability', description: 'Approved expenses not yet paid.' },
  { key: 'sales_tax_payable', code: '2200', name: 'Sales Tax Payable', type: 'liability', description: 'Tax collected on invoices, owed to the authority.' },
  { key: 'owner_equity', code: '3000', name: "Owner's Equity", type: 'equity', description: 'Capital contributed by the owners.' },
  { key: 'retained_earnings', code: '3900', name: 'Retained Earnings', type: 'equity', description: 'Accumulated profit from prior periods.' },
  { key: 'services_revenue', code: '4000', name: 'Services Revenue', type: 'revenue', description: 'Billable work.' },
  { key: 'product_revenue', code: '4100', name: 'Product Revenue', type: 'revenue', description: 'Licences, assets and resold goods.' },
  { key: 'other_income', code: '4900', name: 'Other Income', type: 'revenue', description: 'Interest, refunds and one-offs.' },
  { key: 'software_expense', code: '5100', name: 'Software & Subscriptions', type: 'expense', description: '' },
  { key: 'travel_expense', code: '5200', name: 'Travel', type: 'expense', description: '' },
  { key: 'contractor_expense', code: '5300', name: 'Contractors', type: 'expense', description: '' },
  { key: 'office_expense', code: '5400', name: 'Office & Equipment', type: 'expense', description: '' },
  { key: 'marketing_expense', code: '5500', name: 'Marketing', type: 'expense', description: '' },
  { key: 'other_expense', code: '5900', name: 'Other Expenses', type: 'expense', description: '' },
];

export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  invoicePrefix: 'INV',
  nextInvoiceNumber: 1,
  invoiceNumberPadding: 4,
  defaultPaymentTermsDays: 30,
  defaultTaxRateId: null,
  requireInvoiceApproval: true,
  requireExpenseApproval: true,
  fiscalYearStartMonth: 1,
  invoiceFooter: 'Thank you for your business.',
  address: '',
  email: '',
  phone: '',
};

export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 200;
export const SESSION_COOKIE = 'll_session';
export const SESSION_TTL_DAYS = 30;
export const MIN_PASSWORD_LENGTH = 8;
export const BP_DENOMINATOR = 10_000;

export function labelFor<T extends string>(options: LabeledOption<T>[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export function toneFor<T extends string>(options: LabeledOption<T>[], value: T): Tone {
  return options.find((o) => o.value === value)?.tone ?? 'neutral';
}
