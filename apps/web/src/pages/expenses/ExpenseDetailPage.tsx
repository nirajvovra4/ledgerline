import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  expenseActions,
  formatBp,
  formatDate,
  formatDateTime,
  labelFor,
  PAYMENT_METHODS,
  type ExpenseAction,
} from '@ledgerline/shared';
import { useDeleteExpense, useExpense, useExpenseTransition } from '../../api/expenses';
import { Button, LinkButton } from '../../components/Button';
import { Collapsible } from '../../components/Collapsible';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ErrorState } from '../../components/ErrorState';
import { KeyValue } from '../../components/KeyValue';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { Stat } from '../../components/Stat';
import { ApprovalStamp, ExpenseStamp } from '../../components/StatusStamp';
import { Timeline } from '../../components/Timeline';
import { useAuth } from '../../hooks/useAuth';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { activityToTimeline } from '../../lib/activity';
import { PayExpenseDrawer } from './PayExpenseDrawer';

type Dialog = 'reject' | 'delete' | 'pay' | null;

export function ExpenseDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, role, settings, currency, money } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const query = useExpense(id);
  const transition = useExpenseTransition();
  const remove = useDeleteExpense();
  const [dialog, setDialog] = useState<Dialog>(null);

  if (query.isLoading) return <SkeletonRows rows={8} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  const { expense, approvals, journalEntries, history } = query.data;
  const actions = new Set<ExpenseAction>(
    expenseActions({
      status: expense.status,
      role,
      settings,
      isCreator: expense.createdBy === user?.id,
    }),
  );
  const run = (action: 'submit' | 'approve', label: string) =>
    transition.mutate(
      { id: expense.id, action },
      {
        onSuccess: () => toast.success(label),
        onError: (e) => toast.error('Action failed', e.message),
      },
    );

  return (
    <>
      <PageHeader
        title={expense.vendor}
        meta={<ExpenseStamp status={expense.status} />}
        subtitle={expense.description}
        crumbs={[{ label: 'Expenses', to: `${base}/expenses` }, { label: expense.vendor }]}
        actions={
          <>
            {actions.has('edit') ? (
              <LinkButton to={`${base}/expenses/${expense.id}/edit`}>Edit</LinkButton>
            ) : null}
            {actions.has('delete') ? (
              <Button variant="danger" onClick={() => setDialog('delete')}>
                Delete
              </Button>
            ) : null}
            {actions.has('reject') ? (
              <Button variant="danger" onClick={() => setDialog('reject')}>
                Reject
              </Button>
            ) : null}
          </>
        }
        primary={
          actions.has('pay') ? (
            <Button variant="primary" onClick={() => setDialog('pay')}>
              Record payment
            </Button>
          ) : actions.has('approve') ? (
            <Button
              variant="primary"
              onClick={() => run('approve', 'Expense approved')}
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
        <div className="stack stack--lg">
          <div className="stat-strip">
            <Stat label="Net" value={money.fmt(expense.amountCents)} size="sm" />
            <Stat
              label="Tax"
              value={money.fmt(expense.taxCents)}
              sub={expense.taxRateBp ? formatBp(expense.taxRateBp) : 'no tax'}
              size="sm"
            />
            <Stat
              label="Total"
              value={money.fmt(expense.totalCents)}
              size="sm"
              tone={expense.status === 'paid' ? 'positive' : undefined}
            />
          </div>
          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">Details</h2>
            </div>
            <div className="paper__body">
              <KeyValue
                items={[
                  { key: 'date', label: 'Date', value: formatDate(expense.date) },
                  {
                    key: 'due',
                    label: 'Due',
                    value: expense.dueDate ? formatDate(expense.dueDate) : null,
                  },
                  {
                    key: 'account',
                    label: 'Account',
                    value: (
                      <Link to={`${base}/ledger/accounts/${expense.accountId}`}>
                        {expense.accountName}
                      </Link>
                    ),
                  },
                  {
                    key: 'client',
                    label: 'Client',
                    value: expense.clientId ? (
                      <Link to={`${base}/clients/${expense.clientId}`}>{expense.clientName}</Link>
                    ) : null,
                  },
                  {
                    key: 'project',
                    label: 'Project',
                    value: expense.projectId ? (
                      <Link to={`${base}/projects/${expense.projectId}`}>
                        {expense.projectName}
                      </Link>
                    ) : null,
                  },
                  {
                    key: 'billable',
                    label: 'Billable',
                    value: expense.billable ? 'Yes — rebill to client' : 'No',
                  },
                  { key: 'reference', label: 'Reference', value: expense.reference || null },
                  {
                    key: 'paid',
                    label: 'Paid',
                    value: expense.paidAt
                      ? `${formatDate(expense.paidAt)}${expense.paymentMethod ? ` · ${labelFor(PAYMENT_METHODS, expense.paymentMethod)}` : ''}`
                      : null,
                  },
                  {
                    key: 'by',
                    label: 'Created by',
                    value: `${expense.createdByName} · ${formatDateTime(expense.createdAt)}`,
                  },
                  {
                    key: 'notes',
                    label: 'Notes',
                    value: expense.notes ? (
                      <span style={{ whiteSpace: 'pre-line' }}>{expense.notes}</span>
                    ) : null,
                  },
                ]}
              />
            </div>
          </section>
          {journalEntries.length > 0 ? (
            <section className="paper">
              <div className="paper__body" style={{ paddingTop: 4, paddingBottom: 4 }}>
                <Collapsible title={`Journal entries (${journalEntries.length})`}>
                  <div className="stack stack--sm" style={{ paddingBottom: 8 }}>
                    {journalEntries.map((je) => (
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
        </div>
        <div className="detail-side">
          {approvals.length > 0 ? (
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Approvals</h2>
              </div>
              <ul className="list-plain list-rows" style={{ padding: '0 16px' }}>
                {approvals.map((a) => (
                  <li key={a.id}>
                    <div className="row row--between">
                      <span>{a.requestedByName}</span>
                      <ApprovalStamp status={a.status} />
                    </div>
                    <div className="tiny muted">
                      {formatDateTime(a.createdAt)}
                      {a.decidedByName ? ` · ${a.decidedByName}` : ''}
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
          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">History</h2>
            </div>
            <div className="paper__body">
              <Timeline items={activityToTimeline(history)} />
            </div>
          </section>
        </div>
      </div>
      <ConfirmDialog
        open={dialog === 'reject'}
        onClose={() => setDialog(null)}
        title="Reject this expense?"
        comment={{ label: 'Reason', required: true }}
        confirmLabel="Reject"
        variant="danger"
        onConfirm={async (comment) => {
          await transition.mutateAsync({ id: expense.id, action: 'reject', body: { comment } });
          toast.success('Expense rejected');
        }}
      />
      <ConfirmDialog
        open={dialog === 'delete'}
        onClose={() => setDialog(null)}
        title="Delete this expense?"
        message="Draft expenses can be deleted permanently."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          await remove.mutateAsync(expense.id);
          toast.success('Expense deleted');
          navigate(`${base}/expenses`);
        }}
      />
      {dialog === 'pay' ? (
        <PayExpenseDrawer expense={expense} open onClose={() => setDialog(null)} />
      ) : null}
    </>
  );
}
