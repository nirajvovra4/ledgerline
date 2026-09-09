import type { IsoDate, IsoDateTime } from './types';

/**
 * Calendar-date utilities. Business dates in Ledgerline are plain `YYYY-MM-DD` strings so that
 * they never shift with time zones. All arithmetic happens in UTC on the underlying Date.
 */

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
export const MONTH_SHORT = MONTH_NAMES.map((m) => m.slice(0, 3));
export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_SHORT = WEEKDAY_NAMES.map((d) => d.slice(0, 3));

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false;
  const m = ISO_DATE_RE.exec(value);
  if (!m) return false;
  const [, y, mo, d] = m;
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function parseIsoDate(value: IsoDate): Date {
  if (!isIsoDate(value)) throw new RangeError(`Invalid ISO date: ${value}`);
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

export function toIsoDate(date: Date): IsoDate {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function makeIsoDate(year: number, month: number, day: number): IsoDate {
  return toIsoDate(new Date(Date.UTC(year, month - 1, day)));
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 30;
}

export function dateParts(value: IsoDate): { year: number; month: number; day: number } {
  const d = parseIsoDate(value);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function addDays(value: IsoDate, days: number): IsoDate {
  const d = parseIsoDate(value);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Add months, clamping the day to the end of the target month (Jan 31 + 1 month = Feb 28/29). */
export function addMonths(value: IsoDate, months: number): IsoDate {
  const { year, month, day } = dateParts(value);
  const total = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(total / 12);
  const targetMonth = (total % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return makeIsoDate(targetYear, targetMonth, clampedDay);
}

export function addYears(value: IsoDate, years: number): IsoDate {
  return addMonths(value, years * 12);
}

/** Whole days from `a` to `b` (positive when `b` is later). */
export function diffDays(a: IsoDate, b: IsoDate): number {
  const ms = parseIsoDate(b).getTime() - parseIsoDate(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isBefore(a: IsoDate, b: IsoDate): boolean {
  return a < b;
}

export function isAfter(a: IsoDate, b: IsoDate): boolean {
  return a > b;
}

export function isSameOrBefore(a: IsoDate, b: IsoDate): boolean {
  return a <= b;
}

export function minDate(...dates: IsoDate[]): IsoDate {
  return dates.reduce((m, d) => (d < m ? d : m));
}

export function maxDate(...dates: IsoDate[]): IsoDate {
  return dates.reduce((m, d) => (d > m ? d : m));
}

export function isWithin(value: IsoDate, from: IsoDate | null, to: IsoDate | null): boolean {
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function startOfMonth(value: IsoDate): IsoDate {
  const { year, month } = dateParts(value);
  return makeIsoDate(year, month, 1);
}

export function endOfMonth(value: IsoDate): IsoDate {
  const { year, month } = dateParts(value);
  return makeIsoDate(year, month, daysInMonth(year, month));
}

export function startOfYear(value: IsoDate): IsoDate {
  return makeIsoDate(dateParts(value).year, 1, 1);
}

export function endOfYear(value: IsoDate): IsoDate {
  return makeIsoDate(dateParts(value).year, 12, 31);
}

export function startOfQuarter(value: IsoDate): IsoDate {
  const { year, month } = dateParts(value);
  const qStart = Math.floor((month - 1) / 3) * 3 + 1;
  return makeIsoDate(year, qStart, 1);
}

export function endOfQuarter(value: IsoDate): IsoDate {
  return endOfMonth(addMonths(startOfQuarter(value), 2));
}

/** ISO weekday: 1 = Monday … 7 = Sunday. */
export function isoWeekday(value: IsoDate): number {
  const d = parseIsoDate(value).getUTCDay();
  return d === 0 ? 7 : d;
}

export function isWeekend(value: IsoDate): boolean {
  return isoWeekday(value) >= 6;
}

/** Monday of the week containing `value`. */
export function startOfWeek(value: IsoDate): IsoDate {
  return addDays(value, 1 - isoWeekday(value));
}

export function endOfWeek(value: IsoDate): IsoDate {
  return addDays(startOfWeek(value), 6);
}

export function weekOf(value: IsoDate): IsoDate[] {
  const start = startOfWeek(value);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface DateRange {
  from: IsoDate;
  to: IsoDate;
}

export function monthRange(year: number, month: number): DateRange {
  return { from: makeIsoDate(year, month, 1), to: makeIsoDate(year, month, daysInMonth(year, month)) };
}

export function rangeForPeriod(today: IsoDate, period: 'month' | 'quarter' | 'year'): DateRange {
  switch (period) {
    case 'month':
      return { from: startOfMonth(today), to: endOfMonth(today) };
    case 'quarter':
      return { from: startOfQuarter(today), to: endOfQuarter(today) };
    case 'year':
      return { from: startOfYear(today), to: endOfYear(today) };
  }
}

/** The range immediately preceding `range`, with the same length in months where possible. */
export function previousRange(range: DateRange): DateRange {
  const monthsSpan = monthsBetween(range.from, range.to);
  if (monthsSpan > 0 && range.from === startOfMonth(range.from) && range.to === endOfMonth(range.to)) {
    const from = addMonths(range.from, -monthsSpan);
    return { from, to: endOfMonth(addMonths(from, monthsSpan - 1)) };
  }
  const length = diffDays(range.from, range.to) + 1;
  return { from: addDays(range.from, -length), to: addDays(range.from, -1) };
}

/** Number of calendar months spanned by an inclusive range that starts and ends on month bounds. */
export function monthsBetween(from: IsoDate, to: IsoDate): number {
  const a = dateParts(from);
  const b = dateParts(to);
  return (b.year - a.year) * 12 + (b.month - a.month) + 1;
}

/** Fiscal year containing `today` for a given start month (1..12). */
export function fiscalYearRange(today: IsoDate, startMonth: number): DateRange {
  const { year, month } = dateParts(today);
  const startYear = month >= startMonth ? year : year - 1;
  const from = makeIsoDate(startYear, startMonth, 1);
  const to = addDays(addMonths(from, 12), -1);
  return { from, to };
}

/** Split an inclusive range into calendar-month buckets (first/last may be partial). */
export function splitByMonth(range: DateRange): Array<DateRange & { label: string }> {
  const out: Array<DateRange & { label: string }> = [];
  let cursor = range.from;
  while (cursor <= range.to) {
    const end = minDate(endOfMonth(cursor), range.to);
    const { year, month } = dateParts(cursor);
    out.push({ from: cursor, to: end, label: `${MONTH_SHORT[month - 1]} ${String(year).slice(2)}` });
    cursor = addDays(end, 1);
  }
  return out;
}

export function splitByWeek(range: DateRange): Array<DateRange & { label: string }> {
  const out: Array<DateRange & { label: string }> = [];
  let cursor = range.from;
  while (cursor <= range.to) {
    const end = minDate(endOfWeek(cursor), range.to);
    out.push({ from: cursor, to: end, label: formatDate(cursor, 'short') });
    cursor = addDays(end, 1);
  }
  return out;
}

export function eachDay(range: DateRange): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = range.from;
  while (cursor <= range.to) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

export interface CalendarCell {
  date: IsoDate;
  day: number;
  inMonth: boolean;
  weekend: boolean;
}

/** 6x7 grid of days for a month view, weeks starting on Monday. */
export function calendarGrid(year: number, month: number): CalendarCell[][] {
  const first = makeIsoDate(year, month, 1);
  const gridStart = startOfWeek(first);
  const rows: CalendarCell[][] = [];
  let cursor = gridStart;
  for (let r = 0; r < 6; r++) {
    const row: CalendarCell[] = [];
    for (let c = 0; c < 7; c++) {
      const parts = dateParts(cursor);
      row.push({
        date: cursor,
        day: parts.day,
        inMonth: parts.month === month && parts.year === year,
        weekend: c >= 5,
      });
      cursor = addDays(cursor, 1);
    }
    rows.push(row);
  }
  return rows;
}

export type DateStyle = 'short' | 'medium' | 'long' | 'numeric' | 'month';

/** Deterministic formatter (no Intl) so server and client agree. */
export function formatDate(value: IsoDate | null | undefined, style: DateStyle = 'medium'): string {
  if (!value) return '—';
  if (!isIsoDate(value)) return value;
  const { year, month, day } = dateParts(value);
  switch (style) {
    case 'numeric':
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    case 'short':
      return `${day} ${MONTH_SHORT[month - 1]}`;
    case 'long':
      return `${WEEKDAY_NAMES[isoWeekday(value) - 1]}, ${day} ${MONTH_NAMES[month - 1]} ${year}`;
    case 'month':
      return `${MONTH_NAMES[month - 1]} ${year}`;
    case 'medium':
    default:
      return `${day} ${MONTH_SHORT[month - 1]} ${year}`;
  }
}

export function formatMonthKey(key: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return key;
  return `${MONTH_NAMES[Number(m[2]) - 1]} ${m[1]}`;
}

export function monthKey(value: IsoDate): string {
  return value.slice(0, 7);
}

export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function shiftMonthKey(key: string, delta: number): string {
  const parsed = parseMonthKey(key);
  if (!parsed) return key;
  return monthKey(addMonths(makeIsoDate(parsed.year, parsed.month, 1), delta));
}

export function formatDateRange(range: DateRange): string {
  const a = dateParts(range.from);
  const b = dateParts(range.to);
  if (range.from === range.to) return formatDate(range.from);
  if (a.year === b.year && a.month === b.month) {
    return `${a.day}–${b.day} ${MONTH_SHORT[a.month - 1]} ${a.year}`;
  }
  if (a.year === b.year) {
    return `${a.day} ${MONTH_SHORT[a.month - 1]} – ${b.day} ${MONTH_SHORT[b.month - 1]} ${a.year}`;
  }
  return `${formatDate(range.from)} – ${formatDate(range.to)}`;
}

/** "in 3 days", "today", "5 days ago", relative to a supplied reference date. */
export function formatRelative(value: IsoDate, today: IsoDate): string {
  const days = diffDays(today, value);
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days === -1) return 'yesterday';
  const abs = Math.abs(days);
  let unit: string;
  let count: number;
  if (abs < 14) {
    unit = 'day';
    count = abs;
  } else if (abs < 60) {
    unit = 'week';
    count = Math.round(abs / 7);
  } else if (abs < 365) {
    unit = 'month';
    count = Math.round(abs / 30);
  } else {
    unit = 'year';
    count = Math.round(abs / 365);
  }
  const label = `${count} ${unit}${count === 1 ? '' : 's'}`;
  return days > 0 ? `in ${label}` : `${label} ago`;
}

/** Days overdue (positive) or days until due (negative). */
export function daysOverdue(dueDate: IsoDate, today: IsoDate): number {
  return diffDays(dueDate, today);
}

export function isoDateFromDateTime(value: IsoDateTime): IsoDate {
  return value.slice(0, 10);
}

export function formatDateTime(value: IsoDateTime | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const date = formatDate(toIsoDate(d));
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${date}, ${hh}:${mm}`;
}

/** Build an ISO timestamp for a calendar date at a fixed UTC time (used by seeds and tests). */
export function isoDateTimeAt(value: IsoDate, hour = 9, minute = 0): IsoDateTime {
  const d = parseIsoDate(value);
  d.setUTCHours(hour, minute, 0, 0);
  return d.toISOString();
}
