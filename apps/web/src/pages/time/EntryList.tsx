import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDate,
  groupTimeByDay,
  minutesToDuration,
  type TimeEntryDto,
  type TimeEntryInput,
} from '@ledgerline/shared';
import { useDeleteTimeEntry, useUpdateTimeEntry } from '../../api/time';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { EmptyState } from '../../components/EmptyState';
import { IconPencil, IconTrash } from '../../components/Icons';
import { useAuth } from '../../hooks/useAuth';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { TimeEntryForm } from './TimeEntryForm';

export function EntryList({
  entries,
  emptyLabel,
}: {
  entries: TimeEntryDto[];
  emptyLabel: string;
}) {
  const { base } = useWorkspace();
  const { user } = useAuth();
  const canAll = usePermission('time.manage_all');
  const update = useUpdateTimeEntry();
  const remove = useDeleteTimeEntry();
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<TimeEntryDto | null>(null);

  if (entries.length === 0)
    return <EmptyState title="No time logged" description={emptyLabel} flush />;
  const grouped = [...groupTimeByDay(entries).entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));

  const canEdit = (e: TimeEntryDto) => !e.invoiceId && (canAll || e.userId === user?.id);

  return (
    <div className="paper">
      {grouped.map(([date, bucket]) => (
        <div key={date}>
          <div className="entry-day">
            <span>{formatDate(date, 'long')}</span>
            <span>{minutesToDuration(bucket.minutes)}</span>
          </div>
          {bucket.entries.map((e) =>
            editing === e.id ? (
              <div key={e.id} className="entry-row entry-row--edit">
                <TimeEntryForm
                  entry={e}
                  defaultDate={e.date}
                  onCancel={() => setEditing(null)}
                  onSubmit={async (data: TimeEntryInput) => {
                    await update.mutateAsync({ id: e.id, ...data });
                    setEditing(null);
                    toast.success('Entry updated');
                  }}
                />
              </div>
            ) : (
              <div key={e.id} className="entry-row">
                <span className="entry-row__minutes">{minutesToDuration(e.minutes)}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="entry-row__project truncate">
                    <Link to={`${base}/projects/${e.projectId}`}>{e.projectName}</Link>
                    <span className="muted"> · {e.clientName}</span>
                  </div>
                  <div className="entry-row__desc truncate">
                    {e.description || <span className="muted">No description</span>}
                  </div>
                </div>
                <span className="small muted">{e.userName}</span>
                <span>
                  {e.invoiceId ? (
                    <Link to={`${base}/invoices/${e.invoiceId}`}>
                      <Badge tone="positive">Invoiced</Badge>
                    </Link>
                  ) : e.billable ? (
                    <Badge tone="warning">Unbilled</Badge>
                  ) : (
                    <Badge>Non-billable</Badge>
                  )}
                </span>
                <span className="table__actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Edit entry"
                    disabled={!canEdit(e)}
                    onClick={() => setEditing(e.id)}
                  >
                    <IconPencil />
                  </button>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label="Delete entry"
                    disabled={!canEdit(e)}
                    onClick={() => setDeleting(e)}
                  >
                    <IconTrash />
                  </button>
                </span>
              </div>
            ),
          )}
        </div>
      ))}
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this time entry?"
        message={
          deleting
            ? `${minutesToDuration(deleting.minutes)} on ${deleting.projectName} (${formatDate(deleting.date)}).`
            : undefined
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success('Entry deleted');
        }}
      />
    </div>
  );
}
