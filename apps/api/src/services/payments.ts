import {
  formatMoney,
  postingsForPayment,
  statusAfterPayment,
  type Paginated,
  type PaymentDto,
  type PaymentMethod,
  type RecordPaymentInput,
} from '@ledgerline/shared';
import { sql } from 'kysely';
import { fieldError, invalidTransition, notFound } from '../errors';
import { newId } from '../lib/ids';
import {
  paginated,
  resolvePage,
  resolveSort,
  type PageInput,
  type SortInput,
  type SortSpec,
} from '../lib/pagination';
import { mapPayment } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type WorkspaceCtx } from './context';
import { getInvoiceDetail, paymentsForInvoice } from './invoices';
import { postEntry, reverseEntry } from './journal';
import { notify } from './notifications';

const PAYMENT_SORTS: Record<string, SortSpec> = {
  date: [
    ['pm.date', 'desc'],
    ['pm.rowid', 'desc'],
  ],
  amount: [['pm.amount_cents', 'desc']],
  clientName: [
    ['c.name', 'asc'],
    ['pm.date', 'desc'],
  ],
  invoiceNumber: [['i.number', 'desc']],
  method: [
    ['pm.method', 'asc'],
    ['pm.date', 'desc'],
  ],
};

export interface PaymentListQuery extends PageInput, SortInput {
  clientId?: string;
  from?: string;
  to?: string;
  method?: PaymentMethod;
  invoiceId?: string;
}

export async function listPayments(
  ctx: WorkspaceCtx,
  query: PaymentListQuery,
): Promise<Paginated<PaymentDto>> {
  const page = resolvePage(query);
  let base = ctx.db
    .selectFrom('payments as pm')
    .innerJoin('invoices as i', 'i.id', 'pm.invoice_id')
    .innerJoin('clients as c', 'c.id', 'i.client_id')
    .where('pm.workspace_id', '=', ctx.workspace.id);
  if (query.clientId) base = base.where('i.client_id', '=', query.clientId);
  if (query.invoiceId) base = base.where('pm.invoice_id', '=', query.invoiceId);
  if (query.from) base = base.where('pm.date', '>=', query.from);
  if (query.to) base = base.where('pm.date', '<=', query.to);
  if (query.method) base = base.where('pm.method', '=', query.method);
  const sort = resolveSort(query, PAYMENT_SORTS, 'date', ['pm.rowid', 'desc']);
  let select = base
    .selectAll('pm')
    .select(['i.number as invoice_number', 'i.client_id as client_id', 'c.name as client_name']);
  for (const [col, dir] of sort) select = select.orderBy(sql.ref(col), dir);
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    select.limit(page.pageSize).offset(page.offset).execute(),
  ]);
  return paginated(rows.map(mapPayment), Number(total), page);
}

/** Record a payment against an open invoice, posting Dr cash / Cr AR. */
export async function recordPayment(
  ctx: WorkspaceCtx,
  invoiceId: string,
  input: RecordPaymentInput,
) {
  return withTransaction(ctx, async (tx) => {
    const inv = await tx.db
      .selectFrom('invoices as i')
      .innerJoin('clients as c', 'c.id', 'i.client_id')
      .selectAll('i')
      .select('c.name as client_name')
      .where('i.id', '=', invoiceId)
      .where('i.workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!inv) throw notFound('Invoice');
    if (!['approved', 'sent', 'partially_paid'].includes(inv.status)) {
      throw invalidTransition(
        `Payments can only be recorded against approved or sent invoices (${inv.number} is ${inv.status.replace('_', ' ')})`,
      );
    }
    const balance = inv.total_cents - inv.amount_paid_cents;
    if (input.amountCents > balance) {
      throw fieldError(
        'amountCents',
        `Payment exceeds the outstanding balance of ${formatMoney(balance, inv.currency)}`,
      );
    }
    const id = newId();
    const entry = await postEntry(tx, {
      date: input.date,
      memo: `Payment for ${inv.number} — ${inv.client_name}`,
      sourceType: 'payment',
      sourceId: id,
      lines: postingsForPayment({
        invoiceNumber: inv.number,
        clientName: inv.client_name,
        amountCents: input.amountCents,
        reference: input.reference || undefined,
      }),
    });
    const now = tx.clock.now();
    await tx.db
      .insertInto('payments')
      .values({
        id,
        workspace_id: tx.workspace.id,
        invoice_id: invoiceId,
        date: input.date,
        amount_cents: input.amountCents,
        method: input.method,
        reference: input.reference,
        note: input.note,
        journal_entry_id: entry.id,
        created_by: tx.user.id,
        created_at: now,
      })
      .execute();
    const amountPaid = inv.amount_paid_cents + input.amountCents;
    const status = statusAfterPayment(inv.status, inv.total_cents, amountPaid);
    await tx.db
      .updateTable('invoices')
      .set({ amount_paid_cents: amountPaid, status, updated_at: now })
      .where('id', '=', invoiceId)
      .execute();

    const finance = await tx.db
      .selectFrom('memberships')
      .select('user_id')
      .where('workspace_id', '=', tx.workspace.id)
      .where('role', 'in', ['owner', 'admin', 'accountant'])
      .where('user_id', '!=', tx.user.id)
      .execute();
    await notify(tx, {
      userIds: finance.map((m) => m.user_id),
      kind: 'payment_received',
      title: `Payment received for ${inv.number}`,
      body: `${inv.client_name} paid ${formatMoney(input.amountCents, inv.currency)} by ${input.method.replace('_', ' ')}${status === 'paid' ? ' — invoice settled' : ''}.`,
      link: `/w/${tx.workspace.slug}/invoices/${invoiceId}`,
    });
    await logActivity(tx, {
      entityType: 'payment',
      entityId: id,
      action: 'recorded',
      summary: `${tx.user.name} recorded a payment of ${formatMoney(input.amountCents, inv.currency)} for ${inv.number}`,
      meta: {
        invoiceId,
        invoiceNumber: inv.number,
        amountCents: input.amountCents,
        method: input.method,
      },
    });
    await logActivity(tx, {
      entityType: 'invoice',
      entityId: invoiceId,
      action: status === 'paid' ? 'paid' : 'payment_recorded',
      summary:
        status === 'paid'
          ? `${inv.number} was paid in full by ${inv.client_name}`
          : `${tx.user.name} recorded ${formatMoney(input.amountCents, inv.currency)} against ${inv.number}`,
      meta: { paymentId: id, amountCents: input.amountCents },
    });
    const detail = await getInvoiceDetail(tx, invoiceId);
    const payment = detail.payments.find((p) => p.id === id);
    if (!payment) throw new Error('Payment vanished after insert');
    return { invoice: detail, payment };
  });
}

/** Delete a payment, reversing its journal entry and recomputing the invoice status. */
export async function deletePayment(ctx: WorkspaceCtx, paymentId: string): Promise<void> {
  return withTransaction(ctx, async (tx) => {
    const payment = await tx.db
      .selectFrom('payments')
      .selectAll()
      .where('id', '=', paymentId)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!payment) throw notFound('Payment');
    const inv = await tx.db
      .selectFrom('invoices')
      .selectAll()
      .where('id', '=', payment.invoice_id)
      .executeTakeFirstOrThrow();
    if (payment.journal_entry_id) {
      await reverseEntry(tx, payment.journal_entry_id, {
        date: tx.clock.today(),
        memo: `Reversal of payment for ${inv.number}`,
        // Attribute the reversal to the invoice so it stays on the invoice timeline after the payment row is gone.
        sourceId: inv.id,
      });
    }
    await tx.db.deleteFrom('payments').where('id', '=', paymentId).execute();
    const remaining = await paymentsForInvoice(tx, inv.id);
    const amountPaid = remaining.reduce((s, p) => s + p.amountCents, 0);
    const status = statusAfterPayment(inv.status, inv.total_cents, amountPaid);
    await tx.db
      .updateTable('invoices')
      .set({ amount_paid_cents: amountPaid, status, updated_at: tx.clock.now() })
      .where('id', '=', inv.id)
      .execute();
    await logActivity(tx, {
      entityType: 'payment',
      entityId: paymentId,
      action: 'deleted',
      summary: `${tx.user.name} removed a payment of ${formatMoney(payment.amount_cents, inv.currency)} from ${inv.number}`,
      meta: { invoiceId: inv.id, invoiceNumber: inv.number, amountCents: payment.amount_cents },
    });
  });
}
