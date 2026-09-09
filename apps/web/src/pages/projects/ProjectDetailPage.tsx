import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatBp, formatDate, minutesToDuration, type TimeEntryDto } from '@ledgerline/shared';
import { useArchiveProject, useProject } from '../../api/projects';
import { Button, LinkButton } from '../../components/Button';
import { BarChart } from '../../components/charts';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type Column } from '../../components/DataTable';
import { ErrorState } from '../../components/ErrorState';
import { KeyValue } from '../../components/KeyValue';
import { PageHeader } from '../../components/PageHeader';
import { Progress } from '../../components/Progress';
import { SkeletonRows } from '../../components/Skeleton';
import { Stat } from '../../components/Stat';
import { ProjectStamp } from '../../components/StatusStamp';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';

export function ProjectDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, money } = useWorkspace();
  const canManage = usePermission('projects.manage');
  const canInvoice = usePermission('invoices.create');
  const query = useProject(id);
  const archive = useArchiveProject();
  const toast = useToast();
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (query.isLoading) return <SkeletonRows rows={8} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  const { project, stats, recentEntries } = query.data;
  const budgetPct = stats.budgetUsedBp == null ? null : stats.budgetUsedBp / 100;
  const burnTone =
    budgetPct == null
      ? undefined
      : budgetPct >= 100
        ? 'negative'
        : budgetPct >= 80
          ? 'warning'
          : 'positive';
  const maxMember = Math.max(1, ...stats.byMember.map((m) => m.minutes));

  const entryColumns: Column<TimeEntryDto>[] = [
    { key: 'date', header: 'Date', render: (e) => formatDate(e.date) },
    { key: 'who', header: 'Member', render: (e) => e.userName },
    {
      key: 'desc',
      header: 'Description',
      wrap: true,
      render: (e) => e.description || <span className="muted">—</span>,
    },
    { key: 'min', header: 'Duration', align: 'right', render: (e) => minutesToDuration(e.minutes) },
    {
      key: 'bill',
      header: 'Billable',
      align: 'center',
      render: (e) =>
        e.billable ? (
          e.invoiceId ? (
            <Link to={`${base}/invoices/${e.invoiceId}`}>Invoiced</Link>
          ) : (
            <span className="tone-warning">Unbilled</span>
          )
        ) : (
          <span className="muted">No</span>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={project.name}
        meta={<ProjectStamp status={project.status} />}
        subtitle={
          <>
            <Link to={`${base}/clients/${project.clientId}`}>{project.clientName}</Link>
            {project.code ? <span className="mono"> · {project.code}</span> : null}
          </>
        }
        crumbs={[{ label: 'Projects', to: `${base}/projects` }, { label: project.name }]}
        actions={
          canManage ? (
            <>
              <LinkButton to={`${base}/projects/${project.id}/edit`}>Edit</LinkButton>
              {project.status !== 'archived' ? (
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              ) : null}
            </>
          ) : undefined
        }
        primary={
          canInvoice && stats.unbilledMinutes > 0 ? (
            <LinkButton
              to={`${base}/invoices/from-time?projectId=${project.id}&clientId=${project.clientId}`}
              variant="primary"
            >
              Invoice unbilled time
            </LinkButton>
          ) : undefined
        }
      />
      <div className="stack stack--lg">
        <div className="stat-strip">
          <Stat label="Logged" value={minutesToDuration(stats.loggedMinutes)} size="sm" />
          <Stat label="Billable" value={minutesToDuration(stats.billableMinutes)} size="sm" />
          <Stat
            label="Unbilled"
            value={minutesToDuration(stats.unbilledMinutes)}
            sub={`worth ${money.fmt(stats.unbilledCents)}`}
            size="sm"
            tone={stats.unbilledMinutes > 0 ? 'warning' : undefined}
          />
          <Stat label="Invoiced" value={money.fmt(stats.invoicedCents)} size="sm" />
          <Stat label="Paid" value={money.fmt(stats.paidCents)} size="sm" tone="positive" />
        </div>
        <div className="grid-main-aside">
          <div className="stack stack--lg">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Budget</h2>
                {budgetPct != null ? (
                  <span className={`small tone-${burnTone}`}>
                    {formatBp(stats.budgetUsedBp ?? 0, { decimals: 0 })} used
                  </span>
                ) : null}
              </div>
              <div className="paper__body">
                {budgetPct != null && project.budgetCents > 0 ? (
                  <div className="burn">
                    <Progress
                      value={Math.min(budgetPct, 100)}
                      max={100}
                      tone={burnTone}
                      label="Budget used"
                    />
                    <div className="burn__labels">
                      <span>
                        {money.fmt(stats.invoicedCents + stats.unbilledCents)} consumed (invoiced +
                        unbilled)
                      </span>
                      <span>Budget {money.fmt(project.budgetCents)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="muted small">No budget set for this project.</p>
                )}
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Time by week</h2>
              </div>
              <div className="paper__body">
                <BarChart
                  ariaLabel="Hours logged per week"
                  data={stats.byWeek.map((w) => ({
                    label: formatDate(w.weekStart, 'short'),
                    value: Math.round((w.minutes / 60) * 10) / 10,
                    detail: 'Hours',
                  }))}
                  format={(v) => `${v}h`}
                  emptyLabel="No time logged yet."
                />
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Recent entries</h2>
                <LinkButton size="sm" variant="ghost" to={`${base}/time?projectId=${project.id}`}>
                  Open time log
                </LinkButton>
              </div>
              <DataTable
                columns={entryColumns}
                rows={recentEntries}
                rowKey={(e) => e.id}
                flush
                compact
                empty={{ title: 'No time entries yet' }}
              />
            </section>
          </div>
          <div className="stack stack--lg">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Details</h2>
              </div>
              <div className="paper__body">
                <KeyValue
                  stacked
                  items={[
                    {
                      key: 'billing',
                      label: 'Billing',
                      value:
                        project.billingType === 'hourly'
                          ? `Hourly at ${money.fmt(project.hourlyRateCents)}`
                          : `Fixed price ${money.fmt(project.budgetCents)}`,
                    },
                    {
                      key: 'dates',
                      label: 'Dates',
                      value:
                        project.startDate || project.endDate
                          ? `${formatDate(project.startDate)} → ${formatDate(project.endDate)}`
                          : null,
                    },
                    { key: 'desc', label: 'Description', value: project.description || null },
                  ]}
                />
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">By member</h2>
              </div>
              <div className="paper__body">
                {stats.byMember.length === 0 ? (
                  <p className="muted small">Nobody has logged time yet.</p>
                ) : (
                  <div className="member-bars">
                    {stats.byMember.map((m) => (
                      <div key={m.userId} className="member-bar">
                        <span className="truncate">{m.name}</span>
                        <div className="share-bar">
                          <div
                            className="share-bar__fill"
                            style={{ width: `${(m.minutes / maxMember) * 100}%` }}
                          />
                        </div>
                        <span className="num right">{minutesToDuration(m.minutes)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this project?"
        message="Archived projects no longer accept time entries but keep their history."
        confirmLabel="Archive"
        variant="danger"
        onConfirm={async () => {
          await archive.mutateAsync(project.id);
          toast.success('Project archived');
        }}
      />
    </>
  );
}
