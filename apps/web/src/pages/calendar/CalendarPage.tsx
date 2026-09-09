import { useMemo } from 'react';
import {
  calendarGrid,
  formatDate,
  monthKey,
  parseMonthKey,
  WEEKDAY_SHORT,
  type CalendarEvent,
} from '@ledgerline/shared';
import { useCalendar } from '../../api/workspaces';
import { ErrorState } from '../../components/ErrorState';
import { EventList } from '../../components/EventList';
import { MonthPicker } from '../../components/MonthPicker';
import { PageHeader } from '../../components/PageHeader';
import { Skeleton } from '../../components/Skeleton';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cx } from '../../lib/cx';

const DEFAULTS = { month: '', day: '' };
const LEGEND: Array<{ kind: string; label: string; tone: CalendarEvent['tone'] }> = [
  { kind: 'invoice_due', label: 'Invoice due', tone: 'warning' },
  { kind: 'invoice_issued', label: 'Invoice issued', tone: 'neutral' },
  { kind: 'payment_received', label: 'Payment received', tone: 'positive' },
  { kind: 'expense_due', label: 'Expense due', tone: 'negative' },
  { kind: 'expense_paid', label: 'Expense paid', tone: 'neutral' },
  { kind: 'project_start', label: 'Project start / end', tone: 'neutral' },
];

export function CalendarGrid({
  year,
  month,
  today,
  events,
  selected,
  onSelect,
  compact,
}: {
  year: number;
  month: number;
  today: string;
  events: CalendarEvent[];
  selected: string;
  onSelect: (d: string) => void;
  compact: (c: number) => string;
}) {
  const grid = useMemo(() => calendarGrid(year, month), [year, month]);
  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of events) map.set(e.date, [...(map.get(e.date) ?? []), e]);
    return map;
  }, [events]);
  return (
    <div className="cal" role="grid" aria-label="Month calendar">
      <div className="cal__dow" role="row">
        {WEEKDAY_SHORT.map((d) => (
          <span key={d} role="columnheader">
            {d}
          </span>
        ))}
      </div>
      {grid.map((week, wi) => (
        <div key={wi} className="cal__week" role="row">
          {week.map((cell) => {
            const dayEvents = byDay.get(cell.date) ?? [];
            return (
              <button
                key={cell.date}
                type="button"
                role="gridcell"
                aria-selected={selected === cell.date}
                aria-label={`${formatDate(cell.date, 'long')}${dayEvents.length ? `, ${dayEvents.length} events` : ''}`}
                className={cx(
                  'cal__day',
                  !cell.inMonth && 'is-outside',
                  cell.weekend && 'is-weekend',
                  cell.date === today && 'is-today',
                  selected === cell.date && 'is-selected',
                )}
                onClick={() => onSelect(selected === cell.date ? '' : cell.date)}
                data-date={cell.date}
              >
                <span className="cal__num">{cell.day}</span>
                {dayEvents.slice(0, 3).map((e) => (
                  <span
                    key={e.id}
                    className={cx('cal__chip', `cal__chip--${e.tone}`)}
                    title={e.title}
                  >
                    <span className="truncate">{e.title}</span>
                    {e.amountCents != null ? <span>{compact(e.amountCents)}</span> : null}
                  </span>
                ))}
                {dayEvents.length > 3 ? (
                  <span className="cal__more">+{dayEvents.length - 3} more</span>
                ) : null}
                <span className="cal__dots" aria-hidden="true">
                  {dayEvents.slice(0, 4).map((e) => (
                    <span key={e.id} className={`cal__dot event-list__bar--${e.tone}`} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function CalendarPage() {
  const today = useToday();
  const { money } = useWorkspace();
  const [params, setParams] = useQueryParams(DEFAULTS);
  const key = parseMonthKey(params.month) ? params.month : monthKey(today);
  const { year, month } = parseMonthKey(key)!;
  const events = useCalendar(key);
  const selected = params.day;
  const selectedEvents = (events.data ?? []).filter((e) => e.date === selected);
  const monthEvents = (events.data ?? []).filter((e) => e.date.startsWith(key));

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Due dates, payments and project milestones."
        crumbs={[{ label: 'Calendar' }]}
        actions={
          <MonthPicker
            value={key}
            onChange={(m) => setParams({ month: m, day: '' })}
            todayKey={monthKey(today)}
          />
        }
      />
      <div className="cal-layout">
        <div>
          {events.isLoading && !events.data ? (
            <Skeleton height={520} />
          ) : events.error ? (
            <ErrorState error={events.error} onRetry={() => events.refetch()} />
          ) : (
            <CalendarGrid
              year={year}
              month={month}
              today={today}
              events={events.data ?? []}
              selected={selected}
              onSelect={(day) => setParams({ day })}
              compact={money.compact}
            />
          )}
          <div className="cal__legend" aria-label="Legend">
            {LEGEND.map((l) => (
              <span key={l.kind} className="chart__legend-item">
                <span
                  className={`chart__swatch event-list__bar--${l.tone}`}
                  style={{ width: 8, height: 8, borderRadius: 2 }}
                />
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <aside className="paper">
          <div className="paper__head">
            <h2 className="paper__title">
              {selected ? formatDate(selected, 'long') : 'This month'}
            </h2>
            {selected ? (
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setParams({ day: '' })}
              >
                Show month
              </button>
            ) : null}
          </div>
          <div className="paper__body">
            <EventList
              events={selected ? selectedEvents : monthEvents}
              showDate={!selected}
              emptyLabel={selected ? 'Nothing on this day.' : 'Nothing scheduled this month.'}
            />
          </div>
        </aside>
      </div>
    </>
  );
}
