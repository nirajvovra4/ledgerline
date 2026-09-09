/**
 * Domain types shared by the API and the web client.
 *
 * Conventions:
 *  - money is an integer number of cents
 *  - rates / discounts are basis points (10000 = 100%)
 *  - `IsoDate` is a `YYYY-MM-DD` string, `IsoDateTime` an ISO 8601 UTC timestamp
 */

export type IsoDate = string;
export type IsoDateTime = string;
export type Cents = number;
export type BasisPoints = number;

export type Role = 'owner' | 'admin' | 'accountant' | 'member';

export type ClientStatus = 'active' | 'archived';
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';
export type BillingType = 'hourly' | 'fixed';

export type InvoiceStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'sent'
  | 'partially_paid'
  | 'paid'
  | 'void';

/** Stored status plus the derived `overdue` state. */
export type DerivedInvoiceStatus = InvoiceStatus | 'overdue';

export type ExpenseStatus = 'draft' | 'pending_approval' | 'approved' | 'paid' | 'rejected';

export type PaymentMethod = 'bank_transfer' | 'card' | 'cash' | 'cheque' | 'other';

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';

export type SystemAccountKey =
  | 'cash'
  | 'accounts_receivable'
  | 'input_tax'
  | 'accounts_payable'
  | 'sales_tax_payable'
  | 'owner_equity'
  | 'retained_earnings'
  | 'services_revenue'
  | 'product_revenue'
  | 'other_income'
  | 'software_expense'
  | 'travel_expense'
  | 'contractor_expense'
  | 'office_expense'
  | 'marketing_expense'
  | 'other_expense';

export type JournalSourceType =
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'expense_payment'
  | 'manual'
  | 'reversal';

export type ApprovalSubjectType = 'invoice' | 'expense';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type NotificationKind =
  | 'approval_requested'
  | 'approval_decided'
  | 'invoice_sent'
  | 'payment_received'
  | 'invoice_overdue'
  | 'member_joined'
  | 'mention'
  | 'system';

export type ActivityEntityType =
  | 'client'
  | 'project'
  | 'time_entry'
  | 'invoice'
  | 'payment'
  | 'expense'
  | 'account'
  | 'journal_entry'
  | 'workspace'
  | 'member';

// ---------------------------------------------------------------------------
// Users & workspaces
// ---------------------------------------------------------------------------

export interface UserDto {
  id: string;
  email: string;
  name: string;
  createdAt: IsoDateTime;
}

export interface WorkspaceSettings {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoiceNumberPadding: number;
  defaultPaymentTermsDays: number;
  defaultTaxRateId: string | null;
  requireInvoiceApproval: boolean;
  requireExpenseApproval: boolean;
  fiscalYearStartMonth: number;
  invoiceFooter: string;
  address: string;
  email: string;
  phone: string;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  currency: string;
  role: Role;
  memberCount: number;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  slug: string;
  currency: string;
  settings: WorkspaceSettings;
  createdAt: IsoDateTime;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: Role;
  joinedAt: IsoDateTime;
}

export interface InviteDto {
  id: string;
  email: string;
  role: Role;
  token: string;
  invitedByName: string;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Clients, projects, time
// ---------------------------------------------------------------------------

export interface ClientDto {
  id: string;
  workspaceId: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  taxId: string;
  paymentTermsDays: number;
  notes: string;
  status: ClientStatus;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Denormalised for list views. */
  outstandingCents: Cents;
  invoiceCount: number;
  projectCount: number;
}

export interface ClientStats {
  invoicedCents: Cents;
  paidCents: Cents;
  outstandingCents: Cents;
  overdueCents: Cents;
  invoiceCount: number;
  averageDaysToPay: number | null;
  unbilledMinutes: number;
  unbilledCents: Cents;
}

export interface ProjectDto {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  billingType: BillingType;
  hourlyRateCents: Cents;
  budgetCents: Cents;
  startDate: IsoDate | null;
  endDate: IsoDate | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
  /** Denormalised for list views. */
  loggedMinutes: number;
  billableMinutes: number;
  unbilledMinutes: number;
  invoicedCents: Cents;
}

export interface ProjectStats {
  loggedMinutes: number;
  billableMinutes: number;
  unbilledMinutes: number;
  unbilledCents: Cents;
  invoicedCents: Cents;
  paidCents: Cents;
  budgetUsedBp: BasisPoints | null;
  byMember: Array<{ userId: string; name: string; minutes: number }>;
  byWeek: Array<{ weekStart: IsoDate; minutes: number; billableMinutes: number }>;
}

export interface TimeEntryDto {
  id: string;
  workspaceId: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  clientId: string;
  clientName: string;
  userId: string;
  userName: string;
  date: IsoDate;
  minutes: number;
  description: string;
  billable: boolean;
  invoiceLineId: string | null;
  invoiceId: string | null;
  hourlyRateCents: Cents;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface TimeSummaryDto {
  from: IsoDate;
  to: IsoDate;
  totalMinutes: number;
  billableMinutes: number;
  unbilledMinutes: number;
  byDay: Array<{ date: IsoDate; minutes: number; billableMinutes: number }>;
  byProject: Array<{
    projectId: string;
    projectName: string;
    clientName: string;
    minutes: number;
    billableMinutes: number;
  }>;
}

// ---------------------------------------------------------------------------
// Invoicing
// ---------------------------------------------------------------------------

export interface TaxRateDto {
  id: string;
  workspaceId: string;
  name: string;
  rateBp: BasisPoints;
  isDefault: boolean;
  archived: boolean;
}

export interface InvoiceLineDto {
  id: string;
  invoiceId: string;
  position: number;
  description: string;
  quantity: number;
  unitPriceCents: Cents;
  taxRateId: string | null;
  taxRateBp: BasisPoints;
  accountId: string;
  lineTotalCents: Cents;
  taxCents: Cents;
}

export interface InvoiceDto {
  id: string;
  workspaceId: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  number: string;
  status: InvoiceStatus;
  derivedStatus: DerivedInvoiceStatus;
  issueDate: IsoDate;
  dueDate: IsoDate;
  currency: string;
  discountBp: BasisPoints;
  subtotalCents: Cents;
  discountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
  amountPaidCents: Cents;
  balanceCents: Cents;
  notes: string;
  terms: string;
  poNumber: string;
  sentAt: IsoDateTime | null;
  approvedAt: IsoDateTime | null;
  approvedBy: string | null;
  voidedAt: IsoDateTime | null;
  voidReason: string;
  createdBy: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface InvoiceDetailDto extends InvoiceDto {
  lines: InvoiceLineDto[];
  client: ClientDto;
  project: ProjectDto | null;
  payments: PaymentDto[];
  approvals: ApprovalDto[];
  journalEntries: JournalEntryDto[];
  history: ActivityDto[];
}

export interface InvoiceListSummary {
  count: number;
  totalCents: Cents;
  outstandingCents: Cents;
  overdueCents: Cents;
}

export interface PaymentDto {
  id: string;
  workspaceId: string;
  invoiceId: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  date: IsoDate;
  amountCents: Cents;
  method: PaymentMethod;
  reference: string;
  note: string;
  journalEntryId: string | null;
  createdBy: string;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

export interface ExpenseDto {
  id: string;
  workspaceId: string;
  vendor: string;
  description: string;
  date: IsoDate;
  dueDate: IsoDate | null;
  accountId: string;
  accountName: string;
  amountCents: Cents;
  taxRateId: string | null;
  taxRateBp: BasisPoints;
  taxCents: Cents;
  totalCents: Cents;
  status: ExpenseStatus;
  clientId: string | null;
  clientName: string | null;
  projectId: string | null;
  projectName: string | null;
  billable: boolean;
  paidAt: IsoDate | null;
  paymentMethod: PaymentMethod | null;
  reference: string;
  notes: string;
  createdBy: string;
  createdByName: string;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ExpenseDetailDto {
  expense: ExpenseDto;
  approvals: ApprovalDto[];
  journalEntries: JournalEntryDto[];
  history: ActivityDto[];
}

export interface ExpenseListSummary {
  count: number;
  totalCents: Cents;
  unpaidCents: Cents;
  pendingCents: Cents;
}

// ---------------------------------------------------------------------------
// Ledger
// ---------------------------------------------------------------------------

export interface AccountDto {
  id: string;
  workspaceId: string;
  code: string;
  name: string;
  type: AccountType;
  parentId: string | null;
  isSystem: boolean;
  systemKey: SystemAccountKey | null;
  archived: boolean;
  description: string;
  balanceCents: Cents;
}

export interface AccountNode extends AccountDto {
  children: AccountNode[];
  /** Balance including children. */
  rollupCents: Cents;
}

export interface JournalLineDto {
  id: string;
  entryId: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debitCents: Cents;
  creditCents: Cents;
  description: string;
}

export interface JournalEntryDto {
  id: string;
  workspaceId: string;
  entryNumber: number;
  date: IsoDate;
  memo: string;
  sourceType: JournalSourceType;
  sourceId: string | null;
  reversedEntryId: string | null;
  postedBy: string;
  postedByName: string;
  createdAt: IsoDateTime;
  lines: JournalLineDto[];
  totalDebitCents: Cents;
  totalCreditCents: Cents;
}

export interface RegisterRow {
  entryId: string;
  entryNumber: number;
  date: IsoDate;
  memo: string;
  sourceType: JournalSourceType;
  debitCents: Cents;
  creditCents: Cents;
  runningBalanceCents: Cents;
}

export interface AccountRegisterDto {
  account: AccountDto;
  from: IsoDate | null;
  to: IsoDate | null;
  openingBalanceCents: Cents;
  closingBalanceCents: Cents;
  items: RegisterRow[];
  total: number;
  page: number;
  pageSize: number;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export interface ApprovalDto {
  id: string;
  workspaceId: string;
  subjectType: ApprovalSubjectType;
  subjectId: string;
  subjectLabel: string;
  subjectAmountCents: Cents;
  subjectCounterparty: string;
  requestedBy: string;
  requestedByName: string;
  status: ApprovalStatus;
  decidedBy: string | null;
  decidedByName: string | null;
  comment: string;
  createdAt: IsoDateTime;
  decidedAt: IsoDateTime | null;
}

export interface NotificationDto {
  id: string;
  workspaceId: string;
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  readAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface ActivityDto {
  id: string;
  workspaceId: string;
  actorId: string;
  actorName: string;
  entityType: ActivityEntityType;
  entityId: string;
  action: string;
  summary: string;
  meta: Record<string, unknown>;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Dashboard, calendar, search
// ---------------------------------------------------------------------------

export type DashboardRange = 'month' | 'quarter' | 'year';

export interface DashboardDto {
  range: DashboardRange;
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  currency: string;
  kpis: {
    outstandingCents: Cents;
    overdueCents: Cents;
    overdueCount: number;
    revenueCents: Cents;
    previousRevenueCents: Cents;
    expensesCents: Cents;
    previousExpensesCents: Cents;
    netCents: Cents;
    unbilledMinutes: number;
    unbilledCents: Cents;
    draftInvoiceCount: number;
    pendingApprovalCount: number;
  };
  cashflow: Array<{ label: string; from: IsoDate; to: IsoDate; inCents: Cents; outCents: Cents }>;
  aging: Array<{ bucket: string; label: string; amountCents: Cents; count: number }>;
  topClients: Array<{ clientId: string; name: string; revenueCents: Cents; shareBp: BasisPoints }>;
  recentInvoices: InvoiceDto[];
  recentActivity: ActivityDto[];
  upcoming: CalendarEvent[];
}

export type CalendarEventKind =
  | 'invoice_due'
  | 'invoice_issued'
  | 'payment_received'
  | 'expense_due'
  | 'expense_paid'
  | 'project_start'
  | 'project_end';

export interface CalendarEvent {
  id: string;
  kind: CalendarEventKind;
  date: IsoDate;
  title: string;
  subtitle: string;
  amountCents: Cents | null;
  link: string;
  tone: 'neutral' | 'positive' | 'negative' | 'warning';
}

export interface SearchHit {
  id: string;
  type: 'client' | 'project' | 'invoice' | 'expense';
  title: string;
  subtitle: string;
  link: string;
}

export interface SearchResultsDto {
  clients: SearchHit[];
  projects: SearchHit[];
  invoices: SearchHit[];
  expenses: SearchHit[];
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportLine {
  accountId: string;
  code: string;
  name: string;
  amountCents: Cents;
  previousCents?: Cents;
}

export interface ReportSection {
  key: string;
  title: string;
  lines: ReportLine[];
  totalCents: Cents;
  previousTotalCents?: Cents;
}

export interface ProfitLossDto {
  from: IsoDate;
  to: IsoDate;
  compareFrom: IsoDate | null;
  compareTo: IsoDate | null;
  revenue: ReportSection;
  expenses: ReportSection;
  netIncomeCents: Cents;
  previousNetIncomeCents: Cents | null;
  marginBp: BasisPoints | null;
}

export interface BalanceSheetDto {
  asOf: IsoDate;
  assets: ReportSection;
  liabilities: ReportSection;
  equity: ReportSection;
  currentEarningsCents: Cents;
  totalAssetsCents: Cents;
  totalLiabilitiesAndEquityCents: Cents;
  balanced: boolean;
}

export interface TrialBalanceRow {
  accountId: string;
  code: string;
  name: string;
  type: AccountType;
  debitCents: Cents;
  creditCents: Cents;
}

export interface TrialBalanceDto {
  asOf: IsoDate;
  rows: TrialBalanceRow[];
  totalDebitCents: Cents;
  totalCreditCents: Cents;
  balanced: boolean;
}

export type AgingBucketKey = 'current' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_plus';

export interface AgingBucketTotal {
  bucket: AgingBucketKey;
  label: string;
  amountCents: Cents;
  count: number;
}

export interface AgingClientRow {
  clientId: string;
  clientName: string;
  buckets: Record<AgingBucketKey, Cents>;
  totalCents: Cents;
  oldestDays: number;
}

export interface AgingReportDto {
  asOf: IsoDate;
  buckets: AgingBucketTotal[];
  rows: AgingClientRow[];
  totalCents: Cents;
}

export interface TaxSummaryDto {
  from: IsoDate;
  to: IsoDate;
  collected: Array<{ taxRateId: string | null; name: string; rateBp: BasisPoints; netCents: Cents; taxCents: Cents }>;
  paid: Array<{ taxRateId: string | null; name: string; rateBp: BasisPoints; netCents: Cents; taxCents: Cents }>;
  collectedCents: Cents;
  paidCents: Cents;
  netPayableCents: Cents;
}

export interface RevenueByClientDto {
  from: IsoDate;
  to: IsoDate;
  rows: Array<{
    clientId: string;
    clientName: string;
    invoiceCount: number;
    invoicedCents: Cents;
    paidCents: Cents;
    outstandingCents: Cents;
    shareBp: BasisPoints;
  }>;
  totalCents: Cents;
}

export interface TimeUtilisationDto {
  from: IsoDate;
  to: IsoDate;
  rows: Array<{
    userId: string;
    name: string;
    minutes: number;
    billableMinutes: number;
    utilisationBp: BasisPoints;
    billableValueCents: Cents;
  }>;
  totalMinutes: number;
  billableMinutes: number;
  utilisationBp: BasisPoints;
}

export interface ClientStatementDto {
  client: ClientDto;
  from: IsoDate;
  to: IsoDate;
  openingBalanceCents: Cents;
  closingBalanceCents: Cents;
  rows: Array<{
    date: IsoDate;
    kind: 'invoice' | 'payment' | 'credit';
    reference: string;
    description: string;
    debitCents: Cents;
    creditCents: Cents;
    balanceCents: Cents;
    link: string;
  }>;
}

// ---------------------------------------------------------------------------
// Generic API shapes
// ---------------------------------------------------------------------------

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type ApiErrorCode =
  | 'validation_error'
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'invalid_transition'
  | 'unbalanced_entry'
  | 'internal_error';

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message: string;
    details?: unknown;
  };
}

export interface MetaDto {
  today: IsoDate;
  version: string;
  fixedClock: boolean;
}
