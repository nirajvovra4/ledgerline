import {
  addDays,
  formatDateRange,
  minutesToDuration,
  startOfWeek,
  weekOf,
  type TimeSummaryDto,
} from '@ledgerline/shared';
import { useProjectOptions } from '../../api/projects';
import { useCreateTimeEntry, useTimeEntries, useTimeSummary } from '../../api/time';
import { Button, LinkButton } from '../../components/Button';
import { Checkbox } from '../../components/Checkbox';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { SkeletonRows } from '../../components/Skeleton';
import { Stat } from '../../components/Stat';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { EntryList } from './EntryList';
import { TimeEntryForm } from './TimeEntryForm';
import { WeekStrip } from './WeekStrip';

const DEFAULTS = { week: '', day: '', uninvoiced: false, projectId: '' };

function WeekSummary({ summary }: { summary: TimeSummaryDto }) {
  if (summary.byProject.length === 0) return <p className="muted small">No time this week.</p>;
  const max = Math.max(1, ...summary.byProject.map((p) => p.minutes));
  return (
    <div className="member-bars">
      {summary.byProject.map((p) => (
        <div key={p.projectId} className="member-bar">
          <span className="truncate" title={`${p.clientName} — ${p.projectName}`}>
            {p.projectName}
          </span>
          <div className="share-bar">
            <div className="share-bar__fill" style={{ width: `${(p.minutes / max) * 100}%` }} />
          </div>
          <span className="num right">{minutesToDuration(p.minutes)}</span>
        </div>
      ))}
    </div>
  );
}

export function TimePage() {
  const today = useToday();
  const { base } = useWorkspace();
  const toast = useToast();
  const canInvoice = usePermission('invoices.create');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const weekStart = params.week || startOfWeek(today);
  const days = weekOf(weekStart);
  const from = days[0]!;
  const to = days[6]!;
  const selectedDay = params.day && days.includes(params.day) ? params.day : '';

  const summary = useTimeSummary(from, to);
  const entries = useTimeEntries({
    from,
    to,
    uninvoiced: params.uninvoiced || undefined,
    projectId: params.projectId || undefined,
    pageSize: 200,
  });
  const projects = useProjectOptions();
  const create = useCreateTimeEntry();

  const visible = (entries.data?.items ?? []).filter((e) => !selectedDay || e.date === selectedDay);
  const visibleMinutes = visible.reduce((s, e) => s + e.minutes, 0);
  const isThisWeek = weekStart === startOfWeek(today);

  return (
    <>
      <PageHeader
        title="Time"
        subtitle={formatDateRange({ from, to })}
        crumbs={[{ label: 'Time' }]}
        actions={
          <div className="row">
            <Button
              size="sm"
              onClick={() => setParams({ week: addDays(weekStart, -7), day: '' })}
              aria-label="Previous week"
            >
              ‹ Prev
            </Button>
            <Button
              size="sm"
              onClick={() => setParams({ week: '', day: '' })}
              disabled={isThisWeek}
            >
              This week
            </Button>
            <Button
              size="sm"
              onClick={() => setParams({ week: addDays(weekStart, 7), day: '' })}
              aria-label="Next week"
            >
              Next ›
            </Button>
          </div>
        }
        primary={
          canInvoice ? (
            <LinkButton to={`${base}/invoices/from-time`} variant="primary">
              Invoice unbilled time
            </LinkButton>
          ) : undefined
        }
      />
      <WeekStrip
        days={days}
        selected={selectedDay}
        today={today}
        summary={summary.data}
        onSelect={(day) => setParams({ day })}
      />
      <div className="time-layout">
        <div className="stack">
          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">Log time · {selectedDay ? selectedDay : 'today'}</h2>
            </div>
            <div className="paper__body">
              <TimeEntryForm
                compact
                defaultDate={selectedDay || (days.includes(today) ? today : from)}
                defaultProjectId={params.projectId || undefined}
                onSubmit={async (data) => {
                  await create.mutateAsync(data);
                  toast.success('Time logged', minutesToDuration(data.minutes));
                }}
              />
            </div>
          </section>
          <div className="table-toolbar">
            <span className="small soft">
              {selectedDay ? `Entries for ${selectedDay}` : 'Entries this week'} ·{' '}
              {minutesToDuration(visibleMinutes)}
            </span>
            <span className="grow" />
            <Select
              aria-label="Project filter"
              size="sm"
              value={params.projectId}
              onChange={(e) => setParams({ projectId: e.target.value })}
              placeholder="All projects"
              options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
            <Checkbox
              label="Uninvoiced only"
              checked={params.uninvoiced}
              onChange={(e) => setParams({ uninvoiced: e.target.checked })}
            />
          </div>
          {entries.isLoading ? (
            <SkeletonRows rows={5} />
          ) : entries.error ? (
            <ErrorState error={entries.error} onRetry={() => entries.refetch()} />
          ) : (
            <EntryList
              entries={visible}
              emptyLabel={
                selectedDay
                  ? 'Nothing logged on this day. Use the form above to add an entry.'
                  : 'Nothing logged this week yet.'
              }
            />
          )}
        </div>
        <aside className="stack">
          <div className="stat-strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <Stat
              label="This week"
              value={minutesToDuration(summary.data?.totalMinutes ?? 0)}
              size="sm"
            />
            <Stat
              label="Billable"
              value={minutesToDuration(summary.data?.billableMinutes ?? 0)}
              size="sm"
              sub={
                summary.data
                  ? `${minutesToDuration(summary.data.unbilledMinutes)} unbilled`
                  : undefined
              }
            />
          </div>
          <section className="paper">
            <div className="paper__head">
              <h2 className="paper__title">By project</h2>
            </div>
            <div className="paper__body">
              {summary.isLoading ? (
                <SkeletonRows rows={3} />
              ) : summary.error ? (
                <ErrorState error={summary.error} onRetry={() => summary.refetch()} compact />
              ) : summary.data ? (
                <WeekSummary summary={summary.data} />
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
