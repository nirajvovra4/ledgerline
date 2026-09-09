import type { ApprovalDto, ApprovalStatus, ApprovalSubjectType } from '@ledgerline/shared';
import { sql } from 'kysely';
import { newId } from '../lib/ids';
import { mapApproval, type ApprovalRow } from '../mappers';
import type { Ctx, WorkspaceCtx } from './context';

/** Decorate approval rows with their subject's label/amount/counterparty and user names. */
async function decorate(ctx: Ctx, rows: ApprovalRow[]): Promise<ApprovalDto[]> {
  if (rows.length === 0) return [];
  const invoiceIds = rows.filter((r) => r.subject_type === 'invoice').map((r) => r.subject_id);
  const expenseIds = rows.filter((r) => r.subject_type === 'expense').map((r) => r.subject_id);
  const userIds = [
    ...new Set(rows.flatMap((r) => [r.requested_by, r.decided_by]).filter((v): v is string => !!v)),
  ];

  const [invoices, expenses, users] = await Promise.all([
    invoiceIds.length
      ? ctx.db
          .selectFrom('invoices as i')
          .innerJoin('clients as c', 'c.id', 'i.client_id')
          .select(['i.id', 'i.number', 'i.total_cents', 'c.name as client_name'])
          .where('i.id', 'in', invoiceIds)
          .execute()
      : Promise.resolve([]),
    expenseIds.length
      ? ctx.db
          .selectFrom('expenses')
          .select(['id', 'vendor', 'description', 'total_cents'])
          .where('id', 'in', expenseIds)
          .execute()
      : Promise.resolve([]),
    userIds.length
      ? ctx.db.selectFrom('users').select(['id', 'name']).where('id', 'in', userIds).execute()
      : Promise.resolve([]),
  ]);
  const invoiceById = new Map(invoices.map((i) => [i.id, i] as const));
  const expenseById = new Map(expenses.map((e) => [e.id, e] as const));
  const nameById = new Map(users.map((u) => [u.id, u.name] as const));

  return rows.map((r) => {
    const decorated: ApprovalRow = {
      ...r,
      requested_by_name: nameById.get(r.requested_by) ?? '',
      decided_by_name: r.decided_by ? (nameById.get(r.decided_by) ?? '') : null,
    };
    if (r.subject_type === 'invoice') {
      const inv = invoiceById.get(r.subject_id);
      decorated.subject_label = inv?.number ?? 'Invoice';
      decorated.subject_amount_cents = inv?.total_cents ?? 0;
      decorated.subject_counterparty = inv?.client_name ?? '';
    } else {
      const exp = expenseById.get(r.subject_id);
      decorated.subject_label = exp ? exp.description : 'Expense';
      decorated.subject_amount_cents = exp?.total_cents ?? 0;
      decorated.subject_counterparty = exp?.vendor ?? '';
    }
    return mapApproval(decorated);
  });
}

export async function listApprovals(
  ctx: WorkspaceCtx,
  status: ApprovalStatus | 'all' = 'pending',
): Promise<ApprovalDto[]> {
  let q = ctx.db
    .selectFrom('approvals')
    .selectAll()
    .where('workspace_id', '=', ctx.workspace.id)
    .orderBy('created_at', 'desc')
    .orderBy(sql`rowid`, 'desc')
    .limit(500);
  if (status !== 'all') q = q.where('status', '=', status);
  return decorate(ctx, await q.execute());
}

export async function approvalsForSubject(
  ctx: Ctx,
  subjectType: ApprovalSubjectType,
  subjectId: string,
): Promise<ApprovalDto[]> {
  const rows = await ctx.db
    .selectFrom('approvals')
    .selectAll()
    .where('subject_type', '=', subjectType)
    .where('subject_id', '=', subjectId)
    .orderBy('created_at')
    .orderBy(sql`rowid`)
    .execute();
  return decorate(ctx, rows);
}

export async function pendingApproval(
  ctx: Ctx,
  subjectType: ApprovalSubjectType,
  subjectId: string,
) {
  return ctx.db
    .selectFrom('approvals')
    .selectAll()
    .where('subject_type', '=', subjectType)
    .where('subject_id', '=', subjectId)
    .where('status', '=', 'pending')
    .orderBy('created_at', 'desc')
    .orderBy(sql`rowid`, 'desc')
    .executeTakeFirst();
}

export async function pendingApprovalCount(ctx: Ctx, workspaceId: string): Promise<number> {
  const { c } = await ctx.db
    .selectFrom('approvals')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('workspace_id', '=', workspaceId)
    .where('status', '=', 'pending')
    .executeTakeFirstOrThrow();
  return Number(c);
}

/** Open an approval request; any older pending request for the subject is superseded. */
export async function requestApproval(
  ctx: WorkspaceCtx,
  subjectType: ApprovalSubjectType,
  subjectId: string,
): Promise<string> {
  await ctx.db
    .updateTable('approvals')
    .set({
      status: 'rejected',
      decided_at: ctx.clock.now(),
      comment: 'Superseded by a new request',
    })
    .where('subject_type', '=', subjectType)
    .where('subject_id', '=', subjectId)
    .where('status', '=', 'pending')
    .execute();
  const id = newId();
  await ctx.db
    .insertInto('approvals')
    .values({
      id,
      workspace_id: ctx.workspace.id,
      subject_type: subjectType,
      subject_id: subjectId,
      requested_by: ctx.user.id,
      status: 'pending',
      decided_by: null,
      comment: '',
      created_at: ctx.clock.now(),
      decided_at: null,
    })
    .execute();
  return id;
}

/**
 * Record a decision. When nothing is pending (an approver acting directly on a draft) a
 * self-requested, immediately-decided row is written so the timeline still shows who approved.
 * Returns the id of the user who asked for the approval, if it was someone else.
 */
export async function decideApproval(
  ctx: WorkspaceCtx,
  subjectType: ApprovalSubjectType,
  subjectId: string,
  decision: 'approved' | 'rejected',
  comment: string,
): Promise<{ requestedBy: string | null }> {
  const pending = await pendingApproval(ctx, subjectType, subjectId);
  const now = ctx.clock.now();
  if (pending) {
    await ctx.db
      .updateTable('approvals')
      .set({ status: decision, decided_by: ctx.user.id, decided_at: now, comment })
      .where('id', '=', pending.id)
      .execute();
    return { requestedBy: pending.requested_by !== ctx.user.id ? pending.requested_by : null };
  }
  await ctx.db
    .insertInto('approvals')
    .values({
      id: newId(),
      workspace_id: ctx.workspace.id,
      subject_type: subjectType,
      subject_id: subjectId,
      requested_by: ctx.user.id,
      status: decision,
      decided_by: ctx.user.id,
      comment,
      created_at: now,
      decided_at: now,
    })
    .execute();
  return { requestedBy: null };
}
