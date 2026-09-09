import { can } from '../permissions';
import type { ExpenseStatus, Role, WorkspaceSettings } from '../types';

export const EXPENSE_TRANSITIONS: Record<ExpenseStatus, ExpenseStatus[]> = {
  draft: ['pending_approval', 'approved'],
  pending_approval: ['approved', 'rejected'],
  approved: ['paid'],
  paid: [],
  rejected: ['draft', 'pending_approval'],
};

export function canTransitionExpense(from: ExpenseStatus, to: ExpenseStatus): boolean {
  return EXPENSE_TRANSITIONS[from].includes(to);
}

export function isEditableExpense(status: ExpenseStatus): boolean {
  return status === 'draft' || status === 'rejected';
}

export function isPostedExpense(status: ExpenseStatus): boolean {
  return status === 'approved' || status === 'paid';
}

export type ExpenseAction = 'edit' | 'delete' | 'submit' | 'approve' | 'reject' | 'pay';

export interface ExpenseActionContext {
  status: ExpenseStatus;
  role: Role | null | undefined;
  settings: Pick<WorkspaceSettings, 'requireExpenseApproval'>;
  isCreator: boolean;
}

export function expenseActions(ctx: ExpenseActionContext): ExpenseAction[] {
  const actions: ExpenseAction[] = [];
  const createOk = can(ctx.role, 'expenses.create');
  const approveOk = can(ctx.role, 'expenses.approve');
  const editOk = approveOk || (createOk && ctx.isCreator);
  switch (ctx.status) {
    case 'draft':
    case 'rejected':
      if (editOk) {
        actions.push('edit');
        if (ctx.status === 'draft') actions.push('delete');
        if (ctx.settings.requireExpenseApproval) actions.push('submit');
      }
      if (approveOk) actions.push('approve');
      break;
    case 'pending_approval':
      if (approveOk) actions.push('approve', 'reject');
      break;
    case 'approved':
      if (approveOk) actions.push('pay');
      break;
    case 'paid':
      break;
  }
  return actions;
}
