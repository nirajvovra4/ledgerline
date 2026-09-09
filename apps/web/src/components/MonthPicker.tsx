import { formatMonthKey, shiftMonthKey } from '@ledgerline/shared';
import { Button } from './Button';

export function MonthPicker({
  value,
  onChange,
  todayKey,
}: {
  value: string;
  onChange: (key: string) => void;
  todayKey?: string;
}) {
  return (
    <div className="month-picker" role="group" aria-label="Month">
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(shiftMonthKey(value, -1))}
        aria-label="Previous month"
      >
        ‹
      </Button>
      <span className="month-picker__label" aria-live="polite">
        {formatMonthKey(value)}
      </span>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onChange(shiftMonthKey(value, 1))}
        aria-label="Next month"
      >
        ›
      </Button>
      {todayKey ? (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onChange(todayKey)}
          disabled={value === todayKey}
        >
          Today
        </Button>
      ) : null}
    </div>
  );
}
