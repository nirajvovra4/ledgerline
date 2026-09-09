import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  daysOverdue,
  formatDate,
  formatDateTime,
  formatRelative,
  invoiceActions,
  labelFor,
  PAYMENT_METHODS,
  pluralize,
  type InvoiceAction,
} from '@ledgerline/shared';
import { useDeleteInvoice, useInvoice, useInvoiceTransition } from '../../api/invoices';
import { useTaxRates } from '../../api/taxRates';
import { Button, LinkButton } from '../../components/Button';
import { Collapsible } from '../../components/Collapsible';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState } from '../../components/ErrorState';
import { IconPrint } from '../../components/Icons';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { ApprovalStamp, InvoiceStamp } from '../../components/StatusStamp';
import { Table } from '../../components/Table';
import { Timeline } from '../../components/Timeline';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { activityToTimeline } from '../../lib/activity';
import { modelFromInvoice } from './documentModel';
import { InvoiceDocument } from './InvoiceDocument';
import { RecordPaymentDrawer } from './RecordPaymentDrawer';

type Dialog = 'reject' | 'void' | 'delete' | 'payment' | null;

export function InvoiceDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, role, settings, currency } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const query = useInvoice(id);
  const taxRates = useTaxRates();
  const transition = useInvoiceTransition();
  const remove = useDeleteInvoice();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (query.isLoading) return <SkeletonRows rows={10} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  const inv = query.data;
  if (!inv) return null;

  const actions = new Set<InvoiceAction>(
    invoiceActions({ status: inv.status, role, settings, balanceCents: inv.balanceCents }),
  );
  const overdueDays = inv.derivedStatus === 'overdue' ? daysOverdue(inv.dueDate, today) : 0;
  const model = modelFromInvoice(inv, taxRates.data ?? []);

  const run = (action: 'submit' | 'approve' | 'send', label: string) =>
    transition.mutate(
      { id: inv.id, action },
      {
        onSuccess: () => toast.success(label),
        onError: (e) => toast.error('Action failed', e.message),
      },
    );

  return (
    <>
      <PageHeader
        title={inv.number}
        meta={<InvoiceStamp status={inv.derivedStatus} />}
        subtitle={
          <>
            <Link to={`${base}/clients/${inv.clientId}`}>{inv.clientName}</Link>
            {inv.projectId ? (
              <>
                {' · '}
                <Link to={`${base}/projects/${inv.projectId}`}>{inv.projectName}</Link>
              </>
            ) : null}
          </>
        }
        crumbs={[{ label: 'Invoices', to: `${base}/invoices` }, { label: inv.number }]}
        actions={
          <LinkButton
            to={`${base}/invoices/${inv.id}/print`}
            target="_blank"
            rel="noopener"
            icon={<IconPrint />}
          >
            Print
          </LinkButton>
        }
        primary={
          actions.has('record_payment') ? (
            <Button variant="primary" onClick={() => setDialog('payment')}>
              Record payment
            </Button>
          ) : actions.has('approve') ? (
            <Button
              variant="primary"
              onClick={() => run('approve', 'Invoice approved')}
              loading={transition.isPending}
            >
              Approve
            </Button>
          ) : actions.has('submit') ? (
            <Button
              variant="primary"
              onClick={() => run('submit', 'Submitted for approval')}
              loading={transition.isPending}
            >
              Submit for approval
            </Button>
          ) : undefined
        }
      />
      <div className="grid-main-aside">
        <InvoiceDocument model={model} />
        <div className="detail-side">
          <section className="paper">
            <div className="paper__body detail-side__status">
              <InvoiceStamp status={inv.derivedStatus} size="lg" />
              {overdueDays > 0 ? (
                <div className="overdue-notice">
                  {overdueDays} {overdueDays === 1 ? 'day' : 'days'} overdue · due{' '}
                  {formatDate(inv.dueDate)}
                </div>
              ) : ['sent', 'approved', 'partially_paid'].includes(inv.status) ? (
                <div className="small soft">Due {formatRelative(inv.dueDate, today)}</div>
              ) : null}
              <div className="small">
                Balance <Money cents={inv.balanceCents} currency={currency} /> of{' '}
                <Money cents={inv.totalCents} currency={currency} />
              </div>
              {inv.voidReason ? (
                <div className="small tone-negative">Voided: {inv.voidReason}</div>
              ) : null}
              <div className="detail-side__actions">
                {actions.has('edit') ? (
                  <LinkButton size="sm" to={`${base}/invoices/${inv.id}/edit`}>
                    Edit
                  </LinkButton>
                ) : null}
                {actions.has('submit') ? (
                  <Button
                    size="sm"
                    onClick={() => run('submit', 'Submitted for approval')}
                    loading={transition.isPending}
                  >
                    Submit
                  </Button>
                ) : null}
                {actions.has('approve') ? (
                  <Button
                    size="sm"
                    onClick={() => run('approve', 'Invoice approved')}
                    loading={transition.isPending}
                  >
                    Approve
                  </Button>
                ) : null}
                {actions.has('reject') ? (
                  <Button size="sm" variant="danger" onClick={() => setDialog('reject')}>
                    Reject
                  </Button>
                ) : null}
                {actions.has('send') ? (
                  <Button
                    size="sm"
                    onClick={() => run('send', 'Invoice marked as sent')}
                    loading={transition.isPending}
                  >
                    Mark as sent
                  </Button>
                ) : null}
                {actions.has('record_payment') ? (
                  <Button size="sm" onClick={() => setDialog('payment')}>
                    Record payment
                  </Button>
                ) : null}
                {actions.has('duplicate') ? (
                  <Button
                    size="sm"
                    onClick={() => navigate(`${base}/invoices/new?duplicate=${inv.id}`)}
                  >
                    Duplicate
                  </Button>
                ) : null}
                {actions.has('void') ? (
                  <Button size="sm" variant="danger" onClick={() => setDialog('void')}>
                    Void
                  </Button>
                ) : null}
                {actions.has('delete') ? (
                  <Button size="sm" variant="danger" onClick={() => setDialog('delete')}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          </section>

          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">Payments</h2>
              <span className="muted small">{pluralize(inv.payments.length, 'payment')}</span>
            </div>
            {inv.payments.length === 0 ? (
              <div className="paper__body muted small">No payments recorded.</div>
            ) : (
              <Table compact flush>
                <tbody>
                  {inv.payments.map((p) => (
                    <tr key={p.id}>
                      <td>
                        {formatDate(p.date)}
                        <div className="table__secondary">
                          {labelFor(PAYMENT_METHODS, p.method)}
                          {p.reference ? ` · ${p.reference}` : ''}
                        </div>
                      </td>
                      <td className="is-money">
                        <Money cents={p.amountCents} currency={currency} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </section>

          {inv.approvals.length > 0 ? (
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Approvals</h2>
              </div>
              <ul className="list-plain list-rows" style={{ padding: '0 16px' }}>
                {inv.approvals.map((a) => (
                  <li key={a.id}>
                    <div className="row row--between">
                      <span>Requested by {a.requestedByName}</span>
                      <ApprovalStamp status={a.status} />
                    </div>
                    <div className="tiny muted">
                      {formatDateTime(a.createdAt)}
                      {a.decidedByName ? ` · decided by ${a.decidedByName}` : ''}
                    </div>
                    {a.comment ? (
                      <div className="small soft" style={{ fontStyle: 'italic' }}>
                        “{a.comment}”
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {inv.journalEntries.length > 0 ? (
            <section className="paper">
              <div className="paper__body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                <Collapsible title={`Journal entries (${inv.journalEntries.length})`}>
                  <div className="stack stack--sm" style={{ paddingBottom: 8 }}>
                    {inv.journalEntries.map((je) => (
                      <div key={je.id} className="small">
                        <Link to={`${base}/ledger/journal/${je.id}`}>
                          #{je.entryNumber} · {formatDate(je.date)}
                        </Link>
                        <span className="muted"> · {je.memo}</span>
                        <table className="table table--compact" style={{ marginTop: 4 }}>
                          <tbody>
                            {je.lines.map((l) => (
                              <tr key={l.id}>
                                <td className={l.creditCents ? 'indent-1' : undefined}>
                                  <span className="mono muted">{l.accountCode}</span>{' '}
                                  {l.accountName}
                                </td>
                                <td className="is-money">
                                  {l.debitCents ? (
                                    <Money cents={l.debitCents} currency={currency} />
                                  ) : null}
                                </td>
                                <td className="is-money">
                                  {l.creditCents ? (
                                    <Money cents={l.creditCents} currency={currency} />
                                  ) : null}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                </Collapsible>
              </div>
            </section>
          ) : null}

          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">History</h2>
            </div>
            <div className="paper__body">
              <Timeline items={activityToTimeline(inv.history)} />
            </div>
          </section>
        </div>
      </div>

      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject this invoice?"
        message="It returns to draft so the author can fix it. Tell them why."
        comment={{ label: 'Reason', required: true, placeholder: 'What needs to change?' }}
        confirmLabel="Reject"
        variant="danger"
        onConfirm={async (comment) => {
          await transition.mutateAsync({ id: inv.id, action: 'reject', body: { comment } });
          toast.success('Invoice rejected');
        }}
      />
      <ConfirmDialog
        open={dialog === 'void'}
        onClose={() => setDialog(null)}
        title={`Void ${inv.number}?`}
        message="Voiding reverses the ledger posting. The invoice stays on record but can never be paid."
        comment={{ label: 'Reason', required: true }}
        confirmLabel="Void invoice"
        variant="danger"
        onConfirm={async (reason) => {
          await transition.mutateAsync({ id: inv.id, action: 'void', body: { reason } });
          toast.success('Invoice voided');
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this draft?"
        message="Drafts can be deleted permanently. Time entries attached to it become unbilled again."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          await remove.mutateAsync(inv.id);
          toast.success('Draft deleted');
          navigate(`${base}/invoices`);
        }}
      />
      {dialog === 'payment' ? (
        <RecordPaymentDrawer invoice={inv} open onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
