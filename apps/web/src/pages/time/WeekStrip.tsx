import {
  formatDate,
  minutesToDuration,
  WEEKDAY_SHORT,
  type IsoDate,
  type TimeSummaryDto,
} from '@ledgerline/shared';
import { cx } from '../../lib/cx';

export function WeekStrip({
  days,
  selected,
  today,
  summary,
  onSelect,
}: {
  days: IsoDate[];
  selected: IsoDate | '';
  today: IsoDate;
  summary: TimeSummaryDto | undefined;
  onSelect: (day: IsoDate | '') => void;
}) {
  const byDay = new Map((summary?.byDay ?? []).map((d) => [d.date, d]));
  const max = Math.max(60, ...(summary?.byDay ?? []).map((d) => d.minutes));
  return (
    <div className="week-strip" role="group" aria-label="Days of the week">
      {days.map((d, i) => {
        const entry = byDay.get(d);
        const minutes = entry?.minutes ?? 0;
        const weekend = i >= 5;
        return (
          <button
            key={d}
            type="button"
            className={cx(
              'week-day',
              selected === d && 'is-selected',
              d === today && 'is-today',
              weekend && 'is-weekend',
            )}
            aria-pressed={selected === d}
            onClick={() => onSelect(selected === d ? '' : d)}
            title={formatDate(d, 'long')}
          >
            <span className="week-day__dow">{WEEKDAY_SHORT[i]}</span>
            <span className="week-day__num">{d.slice(8)}</span>
            <span className="week-day__total">
              {minutes > 0 ? minutesToDuration(minutes) : <span className="muted">—</span>}
            </span>
            <span className="week-day__bar" aria-hidden="true">
              <span
                className="week-day__bar-fill"
                style={{ width: `${Math.min(100, (minutes / max) * 100)}%` }}
              />
            </span>
          </button>
        );
      })}
    </div>
  );
}
