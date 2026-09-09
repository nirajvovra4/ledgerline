import { isBefore } from '../dates';
import { can } from '../permissions';
import type { DerivedInvoiceStatus, InvoiceStatus, IsoDate, Role, WorkspaceSettings } from '../types';

export const INVOICE_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
  draft: ['pending_approval', 'approved', 'void'],
  pending_approval: ['approved', 'draft', 'void'],
  approved: ['sent', 'partially_paid', 'paid', 'void'],
  sent: ['partially_paid', 'paid', 'void'],
  partially_paid: ['paid', 'void'],
  paid: [],
  void: [],
};

export function canTransition(from: InvoiceStatus, to: InvoiceStatus): boolean {
  return INVOICE_TRANSITIONS[from].includes(to);
}

export const OPEN_INVOICE_STATUSES: InvoiceStatus[] = ['approved', 'sent', 'partially_paid'];
export const POSTED_INVOICE_STATUSES: InvoiceStatus[] = ['approved', 'sent', 'partially_paid', 'paid'];

export function isOpenInvoice(status: InvoiceStatus): boolean {
  return OPEN_INVOICE_STATUSES.includes(status);
}

/** Whether the invoice has been posted to the ledger (approved or later, not void). */
export function isPostedInvoice(status: InvoiceStatus): boolean {
  return POSTED_INVOICE_STATUSES.includes(status);
}

export function isEditableInvoice(status: InvoiceStatus): boolean {
  return status === 'draft';
}

export function deriveInvoiceStatus(
  invoice: { status: InvoiceStatus; dueDate: IsoDate; balanceCents?: number },
  today: IsoDate,
): DerivedInvoiceStatus {
  if ((invoice.status === 'sent' || invoice.status === 'partially_paid') && isBefore(invoice.dueDate, today)) {
    return 'overdue';
  }
  return invoice.status;
}

/** Status after a payment is applied. */
export function statusAfterPayment(current: InvoiceStatus, totalCents: number, amountPaidCents: number): InvoiceStatus {
  if (current === 'void' || current === 'draft' || current === 'pending_approval') return current;
  if (amountPaidCents >= totalCents) return 'paid';
  if (amountPaidCents > 0) return 'partially_paid';
  return current === 'paid' || current === 'partially_paid' ? 'sent' : current;
}

export type InvoiceAction =
  | 'edit'
  | 'delete'
  | 'submit'
  | 'approve'
  | 'reject'
  | 'send'
  | 'record_payment'
  | 'void'
  | 'print'
  | 'duplicate';

export interface InvoiceActionContext {
  status: InvoiceStatus;
  role: Role | null | undefined;
  settings: Pick<WorkspaceSettings, 'requireInvoiceApproval'>;
  balanceCents: number;
}

/** Actions available to a user for an invoice in its current state. Used by the API and the UI. */
export function invoiceActions(ctx: InvoiceActionContext): InvoiceAction[] {
  const actions: InvoiceAction[] = ['print', 'duplicate'];
  const { status, role, settings } = ctx;
  const createOk = can(role, 'invoices.create');
  const approveOk = can(role, 'invoices.approve');
  const sendOk = can(role, 'invoices.send');
  const voidOk = can(role, 'invoices.void');
  const payOk = can(role, 'payments.manage');

  switch (status) {
    case 'draft':
      if (createOk) {
        actions.push('edit', 'delete');
        if (settings.requireInvoiceApproval) actions.push('submit');
      }
      if (approveOk && !settings.requireInvoiceApproval) actions.push('approve');
      if (approveOk && settings.requireInvoiceApproval) actions.push('approve');
      break;
    case 'pending_approval':
      if (approveOk) actions.push('approve', 'reject');
      if (voidOk) actions.push('void');
      break;
    case 'approved':
      if (sendOk) actions.push('send');
      if (payOk) actions.push('record_payment');
      if (voidOk) actions.push('void');
      break;
    case 'sent':
    case 'partially_paid':
      if (payOk && ctx.balanceCents > 0) actions.push('record_payment');
      if (voidOk) actions.push('void');
      break;
    case 'paid':
    case 'void':
      break;
  }
  return actions;
}
