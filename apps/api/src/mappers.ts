/**
 * Row → DTO mappers. Rows are snake_case database records, optionally widened with joined columns
 * (client names, aggregates); DTOs are the camelCase shapes from `@ledgerline/shared`.
 */
import {
  balanceForInvoice,
  deriveInvoiceStatus,
  type AccountDto,
  type ActivityDto,
  type ApprovalDto,
  type ClientDto,
  type ExpenseDto,
  type InviteDto,
  type InvoiceDto,
  type InvoiceLineDto,
  type IsoDate,
  type JournalEntryDto,
  type JournalLineDto,
  type MemberDto,
  type NotificationDto,
  type PaymentDto,
  type ProjectDto,
  type TaxRateDto,
  type TimeEntryDto,
  type UserDto,
  type WorkspaceDto,
} from '@ledgerline/shared';
import type {
  AccountsTable,
  ActivityLogTable,
  ApprovalsTable,
  ClientsTable,
  ExpensesTable,
  InvitesTable,
  InvoiceLinesTable,
  InvoicesTable,
  JournalEntriesTable,
  JournalLinesTable,
  NotificationsTable,
  PaymentsTable,
  ProjectsTable,
  TaxRatesTable,
  TimeEntriesTable,
  UsersTable,
} from './db/schema';
import { fromDbBool } from './db/schema';
import { parseJson } from './lib/parse';
import type { WorkspaceRecord } from './services/context';

export function mapUser(row: Pick<UsersTable, 'id' | 'email' | 'name' | 'created_at'>): UserDto {
  return { id: row.id, email: row.email, name: row.name, createdAt: row.created_at };
}

export function mapWorkspace(ws: WorkspaceRecord): WorkspaceDto {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    currency: ws.currency,
    settings: ws.settings,
    createdAt: ws.createdAt,
  };
}

export interface MemberRow {
  user_id: string;
  name: string;
  email: string;
  role: MemberDto['role'];
  created_at: string;
}

export function mapMember(row: MemberRow): MemberDto {
  return {
    userId: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    joinedAt: row.created_at,
  };
}

export type InviteRow = InvitesTable & { invited_by_name: string | null };

export function mapInvite(row: InviteRow): InviteDto {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    token: row.token,
    invitedByName: row.invited_by_name ?? '',
    createdAt: row.created_at,
  };
}

export type ClientRow = ClientsTable & {
  outstanding_cents?: number | string | null;
  invoice_count?: number | string | null;
  project_count?: number | string | null;
};

export function mapClient(row: ClientRow): ClientDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    postalCode: row.postal_code,
    country: row.country,
    taxId: row.tax_id,
    paymentTermsDays: row.payment_terms_days,
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    outstandingCents: num(row.outstanding_cents),
    invoiceCount: num(row.invoice_count),
    projectCount: num(row.project_count),
  };
}

export type ProjectRow = ProjectsTable & {
  client_name?: string | null;
  logged_minutes?: number | string | null;
  billable_minutes?: number | string | null;
  unbilled_minutes?: number | string | null;
  invoiced_cents?: number | string | null;
};

export function mapProject(row: ProjectRow): ProjectDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    clientName: row.client_name ?? '',
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    billingType: row.billing_type,
    hourlyRateCents: row.hourly_rate_cents,
    budgetCents: row.budget_cents,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    loggedMinutes: num(row.logged_minutes),
    billableMinutes: num(row.billable_minutes),
    unbilledMinutes: num(row.unbilled_minutes),
    invoicedCents: num(row.invoiced_cents),
  };
}

export type TimeEntryRow = TimeEntriesTable & {
  project_name?: string | null;
  project_code?: string | null;
  client_id?: string | null;
  client_name?: string | null;
  user_name?: string | null;
  invoice_id?: string | null;
  hourly_rate_cents?: number | null;
};

export function mapTimeEntry(row: TimeEntryRow): TimeEntryDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    projectId: row.project_id,
    projectName: row.project_name ?? '',
    projectCode: row.project_code ?? '',
    clientId: row.client_id ?? '',
    clientName: row.client_name ?? '',
    userId: row.user_id,
    userName: row.user_name ?? '',
    date: row.date,
    minutes: row.minutes,
    description: row.description,
    billable: fromDbBool(row.billable),
    invoiceLineId: row.invoice_line_id,
    invoiceId: row.invoice_id ?? null,
    hourlyRateCents: row.hourly_rate_cents ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTaxRate(row: TaxRatesTable): TaxRateDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    rateBp: row.rate_bp,
    isDefault: fromDbBool(row.is_default),
    archived: fromDbBool(row.archived),
  };
}

export function mapInvoiceLine(row: InvoiceLinesTable): InvoiceLineDto {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    position: row.position,
    description: row.description,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    taxRateId: row.tax_rate_id,
    taxRateBp: row.tax_rate_bp,
    accountId: row.account_id,
    lineTotalCents: row.line_total_cents,
    taxCents: row.tax_cents,
  };
}

export type InvoiceRow = InvoicesTable & {
  client_name?: string | null;
  project_name?: string | null;
};

export function mapInvoice(row: InvoiceRow, today: IsoDate): InvoiceDto {
  const balanceCents = balanceForInvoice(row.total_cents, row.amount_paid_cents);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    clientId: row.client_id,
    clientName: row.client_name ?? '',
    projectId: row.project_id,
    projectName: row.project_id ? (row.project_name ?? null) : null,
    number: row.number,
    status: row.status,
    derivedStatus: deriveInvoiceStatus(
      { status: row.status, dueDate: row.due_date, balanceCents },
      today,
    ),
    issueDate: row.issue_date,
    dueDate: row.due_date,
    currency: row.currency,
    discountBp: row.discount_bp,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    amountPaidCents: row.amount_paid_cents,
    balanceCents,
    notes: row.notes,
    terms: row.terms,
    poNumber: row.po_number,
    sentAt: row.sent_at,
    approvedAt: row.approved_at,
    approvedBy: row.approved_by,
    voidedAt: row.voided_at,
    voidReason: row.void_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type PaymentRow = PaymentsTable & {
  invoice_number?: string | null;
  client_id?: string | null;
  client_name?: string | null;
};

export function mapPayment(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    invoiceId: row.invoice_id,
    invoiceNumber: row.invoice_number ?? '',
    clientId: row.client_id ?? '',
    clientName: row.client_name ?? '',
    date: row.date,
    amountCents: row.amount_cents,
    method: row.method,
    reference: row.reference,
    note: row.note,
    journalEntryId: row.journal_entry_id,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export type ExpenseRow = ExpensesTable & {
  account_name?: string | null;
  client_name?: string | null;
  project_name?: string | null;
  created_by_name?: string | null;
};

export function mapExpense(row: ExpenseRow): ExpenseDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    vendor: row.vendor,
    description: row.description,
    date: row.date,
    dueDate: row.due_date,
    accountId: row.account_id,
    accountName: row.account_name ?? '',
    amountCents: row.amount_cents,
    taxRateId: row.tax_rate_id,
    taxRateBp: row.tax_rate_bp,
    taxCents: row.tax_cents,
    totalCents: row.total_cents,
    status: row.status,
    clientId: row.client_id,
    clientName: row.client_id ? (row.client_name ?? null) : null,
    projectId: row.project_id,
    projectName: row.project_id ? (row.project_name ?? null) : null,
    billable: fromDbBool(row.billable),
    paidAt: row.paid_at,
    paymentMethod: row.payment_method,
    reference: row.reference,
    notes: row.notes,
    createdBy: row.created_by,
    createdByName: row.created_by_name ?? '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapAccount(row: AccountsTable, balanceCents = 0): AccountDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    code: row.code,
    name: row.name,
    type: row.type,
    parentId: row.parent_id,
    isSystem: fromDbBool(row.is_system),
    systemKey: row.system_key,
    archived: fromDbBool(row.archived),
    description: row.description,
    balanceCents,
  };
}

export type JournalLineRow = JournalLinesTable & {
  account_code?: string | null;
  account_name?: string | null;
};

export function mapJournalLine(row: JournalLineRow): JournalLineDto {
  return {
    id: row.id,
    entryId: row.entry_id,
    accountId: row.account_id,
    accountCode: row.account_code ?? '',
    accountName: row.account_name ?? '',
    debitCents: row.debit_cents,
    creditCents: row.credit_cents,
    description: row.description,
  };
}

export type JournalEntryRow = JournalEntriesTable & { posted_by_name?: string | null };

export function mapJournalEntry(row: JournalEntryRow, lines: JournalLineRow[]): JournalEntryDto {
  const mapped = lines.map(mapJournalLine);
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    entryNumber: row.entry_number,
    date: row.date,
    memo: row.memo,
    sourceType: row.source_type,
    sourceId: row.source_id,
    reversedEntryId: row.reversed_entry_id,
    postedBy: row.posted_by,
    postedByName: row.posted_by_name ?? '',
    createdAt: row.created_at,
    lines: mapped,
    totalDebitCents: mapped.reduce((s, l) => s + l.debitCents, 0),
    totalCreditCents: mapped.reduce((s, l) => s + l.creditCents, 0),
  };
}

export type ApprovalRow = ApprovalsTable & {
  requested_by_name?: string | null;
  decided_by_name?: string | null;
  subject_label?: string | null;
  subject_amount_cents?: number | null;
  subject_counterparty?: string | null;
};

export function mapApproval(row: ApprovalRow): ApprovalDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    subjectType: row.subject_type,
    subjectId: row.subject_id,
    subjectLabel: row.subject_label ?? '',
    subjectAmountCents: row.subject_amount_cents ?? 0,
    subjectCounterparty: row.subject_counterparty ?? '',
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name ?? '',
    status: row.status,
    decidedBy: row.decided_by,
    decidedByName: row.decided_by ? (row.decided_by_name ?? null) : null,
    comment: row.comment,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

export function mapNotification(row: NotificationsTable): NotificationDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export type ActivityRow = ActivityLogTable & { actor_name?: string | null };

export function mapActivity(row: ActivityRow): ActivityDto {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    actorId: row.actor_id,
    actorName: row.actor_name ?? '',
    entityType: row.entity_type,
    entityId: row.entity_id,
    action: row.action,
    summary: row.summary,
    meta: parseJson<Record<string, unknown>>(row.meta, {}),
    createdAt: row.created_at,
  };
}

/** SQLite aggregates come back as numbers, but be defensive about strings/nulls. */
function num(value: number | string | null | undefined): number {
  if (value == null) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}
