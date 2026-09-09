/**
 * Kysely table definitions. Column names are snake_case (the DTO mappers translate to camelCase).
 *
 * Storage conventions (see DESIGN.md §1):
 *  - booleans are INTEGER 0/1
 *  - money is INTEGER cents
 *  - business dates are TEXT `YYYY-MM-DD`, timestamps TEXT ISO 8601 UTC
 *  - JSON blobs (workspace settings, activity meta) are TEXT
 */
import type {
  AccountType,
  ApprovalStatus,
  ApprovalSubjectType,
  BillingType,
  ClientStatus,
  ExpenseStatus,
  InvoiceStatus,
  JournalSourceType,
  NotificationKind,
  PaymentMethod,
  ProjectStatus,
  Role,
  SystemAccountKey,
  ActivityEntityType,
} from '@ledgerline/shared';

/** SQLite has no boolean type; we store 0/1. */
export type DbBool = 0 | 1;

export interface UsersTable {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface SessionsTable {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export interface WorkspacesTable {
  id: string;
  name: string;
  slug: string;
  currency: string;
  /** JSON-encoded `WorkspaceSettings`. */
  settings: string;
  created_at: string;
  updated_at: string;
}

export interface MembershipsTable {
  workspace_id: string;
  user_id: string;
  role: Role;
  created_at: string;
}

export interface InvitesTable {
  id: string;
  workspace_id: string;
  email: string;
  role: Role;
  token: string;
  invited_by: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ClientsTable {
  id: string;
  workspace_id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  city: string;
  region: string;
  postal_code: string;
  country: string;
  tax_id: string;
  payment_terms_days: number;
  notes: string;
  status: ClientStatus;
  created_at: string;
  updated_at: string;
}

export interface ProjectsTable {
  id: string;
  workspace_id: string;
  client_id: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  billing_type: BillingType;
  hourly_rate_cents: number;
  budget_cents: number;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface TimeEntriesTable {
  id: string;
  workspace_id: string;
  project_id: string;
  user_id: string;
  date: string;
  minutes: number;
  description: string;
  billable: DbBool;
  invoice_line_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaxRatesTable {
  id: string;
  workspace_id: string;
  name: string;
  rate_bp: number;
  is_default: DbBool;
  archived: DbBool;
}

export interface InvoicesTable {
  id: string;
  workspace_id: string;
  client_id: string;
  project_id: string | null;
  number: string;
  status: InvoiceStatus;
  issue_date: string;
  due_date: string;
  currency: string;
  discount_bp: number;
  subtotal_cents: number;
  discount_cents: number;
  tax_cents: number;
  total_cents: number;
  amount_paid_cents: number;
  notes: string;
  terms: string;
  po_number: string;
  sent_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  voided_at: string | null;
  void_reason: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface InvoiceLinesTable {
  id: string;
  invoice_id: string;
  position: number;
  description: string;
  quantity: number;
  unit_price_cents: number;
  tax_rate_id: string | null;
  tax_rate_bp: number;
  account_id: string;
  line_total_cents: number;
  tax_cents: number;
}

export interface PaymentsTable {
  id: string;
  workspace_id: string;
  invoice_id: string;
  date: string;
  amount_cents: number;
  method: PaymentMethod;
  reference: string;
  note: string;
  journal_entry_id: string | null;
  created_by: string;
  created_at: string;
}

export interface ExpensesTable {
  id: string;
  workspace_id: string;
  vendor: string;
  description: string;
  date: string;
  due_date: string | null;
  account_id: string;
  amount_cents: number;
  tax_rate_id: string | null;
  tax_rate_bp: number;
  tax_cents: number;
  total_cents: number;
  status: ExpenseStatus;
  client_id: string | null;
  project_id: string | null;
  billable: DbBool;
  paid_at: string | null;
  payment_method: PaymentMethod | null;
  reference: string;
  notes: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface AccountsTable {
  id: string;
  workspace_id: string;
  code: string;
  name: string;
  type: AccountType;
  parent_id: string | null;
  is_system: DbBool;
  system_key: SystemAccountKey | null;
  archived: DbBool;
  description: string;
  created_at: string;
}

export interface JournalEntriesTable {
  id: string;
  workspace_id: string;
  entry_number: number;
  date: string;
  memo: string;
  source_type: JournalSourceType;
  source_id: string | null;
  reversed_entry_id: string | null;
  posted_by: string;
  created_at: string;
}

export interface JournalLinesTable {
  id: string;
  entry_id: string;
  position: number;
  account_id: string;
  debit_cents: number;
  credit_cents: number;
  description: string;
}

export interface ApprovalsTable {
  id: string;
  workspace_id: string;
  subject_type: ApprovalSubjectType;
  subject_id: string;
  requested_by: string;
  status: ApprovalStatus;
  decided_by: string | null;
  comment: string;
  created_at: string;
  decided_at: string | null;
}

export interface NotificationsTable {
  id: string;
  workspace_id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  read_at: string | null;
  created_at: string;
}

export interface ActivityLogTable {
  id: string;
  workspace_id: string;
  actor_id: string;
  entity_type: ActivityEntityType;
  entity_id: string;
  action: string;
  summary: string;
  /** JSON-encoded object. */
  meta: string;
  created_at: string;
}

export interface Database {
  users: UsersTable;
  sessions: SessionsTable;
  workspaces: WorkspacesTable;
  memberships: MembershipsTable;
  invites: InvitesTable;
  clients: ClientsTable;
  projects: ProjectsTable;
  time_entries: TimeEntriesTable;
  tax_rates: TaxRatesTable;
  invoices: InvoicesTable;
  invoice_lines: InvoiceLinesTable;
  payments: PaymentsTable;
  expenses: ExpensesTable;
  accounts: AccountsTable;
  journal_entries: JournalEntriesTable;
  journal_lines: JournalLinesTable;
  approvals: ApprovalsTable;
  notifications: NotificationsTable;
  activity_log: ActivityLogTable;
}

/** Every table name, in an order that is safe for deleting (children first). */
export const TABLES_FOR_RESET: Array<keyof Database> = [
  'activity_log',
  'notifications',
  'approvals',
  'journal_lines',
  'journal_entries',
  'payments',
  'invoice_lines',
  'time_entries',
  'expenses',
  'invoices',
  'projects',
  'clients',
  'tax_rates',
  'accounts',
  'invites',
  'memberships',
  'sessions',
  'workspaces',
  'users',
];

export function toDbBool(value: boolean): DbBool {
  return value ? 1 : 0;
}

export function fromDbBool(value: number | null | undefined): boolean {
  return value === 1;
}
