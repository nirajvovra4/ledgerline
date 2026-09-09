import {
  addDays,
  addMonths,
  endOfMonth,
  fiscalYearRange,
  rangeForPeriod,
  startOfMonth,
  type DateRange,
  type IsoDate,
} from '@ledgerline/shared';

export type RangePreset =
  'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'fiscal_year' | 'last_30' | 'custom';

export const RANGE_PRESETS: Array<{ value: RangePreset; label: string }> = [
  { value: 'this_month', label: 'This month' },
  { value: 'last_month', label: 'Last month' },
  { value: 'this_quarter', label: 'This quarter' },
  { value: 'this_year', label: 'This year' },
  { value: 'fiscal_year', label: 'Fiscal year' },
  { value: 'last_30', label: 'Last 30 days' },
  { value: 'custom', label: 'Custom' },
];

export function rangeForPreset(
  preset: RangePreset,
  today: IsoDate,
  fiscalYearStartMonth = 1,
): DateRange | null {
  switch (preset) {
    case 'this_month':
      return rangeForPeriod(today, 'month');
    case 'last_month': {
      const from = startOfMonth(addMonths(today, -1));
      return { from, to: endOfMonth(from) };
    }
    case 'this_quarter':
      return rangeForPeriod(today, 'quarter');
    case 'this_year':
      return rangeForPeriod(today, 'year');
    case 'fiscal_year':
      return fiscalYearRange(today, fiscalYearStartMonth);
    case 'last_30':
      return { from: addDays(today, -29), to: today };
    case 'custom':
      return null;
  }
}

/** Which preset (if any) exactly matches a range. */
export function presetForRange(
  range: DateRange,
  today: IsoDate,
  fiscalYearStartMonth = 1,
): RangePreset {
  for (const p of RANGE_PRESETS) {
    if (p.value === 'custom') continue;
    const r = rangeForPreset(p.value, today, fiscalYearStartMonth);
    if (r && r.from === range.from && r.to === range.to) return p.value;
  }
  return 'custom';
}

/** Browser-local calendar date, only used as a fallback while the server clock loads. */
export function browserToday(): IsoDate {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
