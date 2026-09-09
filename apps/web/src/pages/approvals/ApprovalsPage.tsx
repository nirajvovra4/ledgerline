import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDateTime,
  formatRelative,
  isoDateFromDateTime,
  pluralize,
  type ApprovalDto,
} from '@ledgerline/shared';
import { useApprovals, useDecideApproval, type ApprovalFilter } from '../../api/approvals';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { ApprovalStamp } from '../../components/StatusStamp';
import { Tabs } from '../../components/Tabs';
import { useAnyPermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';

const DEFAULTS = { status: 'pending' };
const TABS: Array<{ key: ApprovalFilter; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function ApprovalsPage() {
  const { base, currency } = useWorkspace();
  const today = useToday();
  const toast = useToast();
  const canDecide = useAnyPermission(['invoices.approve', 'expenses.approve']);
  const [params, setParams] = useQueryParams(DEFAULTS);
  const status = (
    TABS.some((t) => t.key === params.status) ? params.status : 'pending'
  ) as ApprovalFilter;
  const query = useApprovals(status);
  const decide = useDecideApproval();
  const [rejecting, setRejecting] = useState<ApprovalDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const subjectLink = (a: ApprovalDto) =>
    `${base}/${a.subjectType === 'invoice' ? 'invoices' : 'expenses'}/${a.subjectId}`;
  const approve = (a: ApprovalDto) => {
    setBusyId(a.id);
    decide.mutate(
      { approval: a, decision: 'approve' },
      {
        onSuccess: () => toast.success(`${a.subjectLabel} approved`),
        onError: (e) => toast.error('Could not approve', e.message),
        onSettled: () => setBusyId(null),
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle={query.data ? pluralize(query.data.length, 'item') : undefined}
        crumbs={[{ label: 'Approvals' }]}
      />
      <Tabs
        items={TABS}
        value={status}
        onChange={(s) => setParams({ status: s })}
        ariaLabel="Approval status"
      />
      {query.isLoading ? (
        <SkeletonRows rows={5} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          title={status === 'pending' ? 'Nothing waiting for approval' : 'No approvals here'}
          description={
            status === 'pending'
              ? 'Submitted invoices and expenses will appear here for review.'
              : undefined
          }
        />
      ) : (
        <div className="paper">
          {(query.data ?? []).map((a) => (
            <div key={a.id} className="approval-row">
              <Avatar name={a.requestedByName} />
              <div style={{ minWidth: 0 }}>
                <div className="approval-row__subject">
                  <Link to={subjectLink(a)}>{a.subjectLabel}</Link>
                  <span className="muted"> · {a.subjectCounterparty}</span>
                </div>
                <div className="approval-row__meta">
                  Requested by {a.requestedByName}{' '}
                  {formatRelative(isoDateFromDateTime(a.createdAt), today)} ·{' '}
                  {formatDateTime(a.createdAt)}
                  {a.decidedByName ? ` · decided by ${a.decidedByName}` : ''}
                  {a.comment ? <span> · “{a.comment}”</span> : null}
                </div>
              </div>
              <Money cents={a.subjectAmountCents} currency={currency} />
              {a.status === 'pending' && canDecide ? (
                <div className="row">
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setRejecting(a)}
                    disabled={busyId === a.id}
                  >
                    Reject
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => approve(a)}
                    loading={busyId === a.id}
                  >
                    Approve
                  </Button>
                </div>
              ) : (
                <ApprovalStamp status={a.status} />
              )}
            </div>
          ))}
        </div>
      )}
      <ConfirmDialog
        open={Boolean(rejecting)}
        onClose={() => setRejecting(null)}
        title={rejecting ? `Reject ${rejecting.subjectLabel}?` : 'Reject'}
        comment={{
          label: 'Reason for rejection',
          required: true,
          placeholder: 'What needs to change?',
        }}
        confirmLabel="Reject"
        variant="danger"
        onConfirm={async (comment) => {
          if (!rejecting) return;
          await decide.mutateAsync({ approval: rejecting, decision: 'reject', comment });
          toast.success('Rejected with comment');
        }}
      />
    </>
  );
}
