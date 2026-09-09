import { mulCents } from './money';
import type { Cents, IsoDate } from './types';

/** "1h 30m" style formatting. Zero renders as "0m". */
export function minutesToDuration(
  minutes: number,
  style: 'short' | 'clock' | 'decimal' = 'short',
): string {
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  switch (style) {
    case 'clock':
      return `${sign}${h}:${String(m).padStart(2, '0')}`;
    case 'decimal':
      return `${sign}${(abs / 60).toFixed(2)}h`;
    default:
      if (h === 0) return `${sign}${m}m`;
      if (m === 0) return `${sign}${h}h`;
      return `${sign}${h}h ${m}m`;
  }
}

/**
 * Parse duration input in any of the common forms:
 *   "1h 30m", "1h30", "90m", "1.5", "1.5h", "1:30", "0:45", "2"
 * Returns whole minutes, or null when unparseable.
 */
export function parseDuration(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+):(\d{1,2})$/.exec(s))) {
    const mins = Number(m[2]);
    if (mins >= 60) return null;
    return Number(m[1]) * 60 + mins;
  }
  if ((m = /^(\d+(?:\.\d+)?)h(?:(\d{1,2})m?)?$/.exec(s))) {
    return Math.round(Number(m[1]) * 60 + Number(m[2] ?? 0));
  }
  if ((m = /^(\d+)m$/.exec(s))) {
    return Number(m[1]);
  }
  if ((m = /^(\d+(?:\.\d+)?)$/.exec(s))) {
    return Math.round(Number(m[1]) * 60);
  }
  return null;
}

export function billableAmount(minutes: number, hourlyRateCents: Cents): Cents {
  return mulCents(hourlyRateCents, minutes / 60);
}

export interface TimeLike {
  date: IsoDate;
  minutes: number;
  billable: boolean;
}

export function groupTimeByDay<T extends TimeLike>(
  entries: T[],
): Map<IsoDate, { minutes: number; billableMinutes: number; entries: T[] }> {
  const map = new Map<IsoDate, { minutes: number; billableMinutes: number; entries: T[] }>();
  for (const e of entries) {
    let bucket = map.get(e.date);
    if (!bucket) {
      bucket = { minutes: 0, billableMinutes: 0, entries: [] };
      map.set(e.date, bucket);
    }
    bucket.minutes += e.minutes;
    if (e.billable) bucket.billableMinutes += e.minutes;
    bucket.entries.push(e);
  }
  return map;
}

export function sumMinutes(entries: Array<{ minutes: number }>): number {
  return entries.reduce((a, e) => a + e.minutes, 0);
}

export function utilisationBp(billableMinutes: number, totalMinutes: number): number {
  if (totalMinutes <= 0) return 0;
  return Math.round((billableMinutes * 10_000) / totalMinutes);
}

/** Round minutes up to the nearest increment (e.g. 15 for quarter-hour billing). */
export function roundMinutesUp(minutes: number, increment: number): number {
  if (increment <= 0) return minutes;
  return Math.ceil(minutes / increment) * increment;
}
