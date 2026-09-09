import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  addYears,
  calendarGrid,
  compareIsoDates,
  dateParts,
  daysInMonth,
  daysOverdue,
  diffDays,
  eachDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  endOfYear,
  fiscalYearRange,
  formatDate,
  formatDateRange,
  formatDateTime,
  formatMonthKey,
  formatRelative,
  isAfter,
  isBefore,
  isIsoDate,
  isLeapYear,
  isSameOrBefore,
  isWeekend,
  isWithin,
  isoDateFromDateTime,
  isoDateTimeAt,
  isoWeekday,
  makeIsoDate,
  maxDate,
  minDate,
  monthKey,
  monthRange,
  monthsBetween,
  MONTH_NAMES,
  MONTH_SHORT,
  parseIsoDate,
  parseMonthKey,
  previousRange,
  rangeForPeriod,
  shiftMonthKey,
  splitByMonth,
  splitByWeek,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
  toIsoDate,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  weekOf,
} from './dates';

describe('isIsoDate', () => {
  it('accepts real calendar dates', () => {
    expect(isIsoDate('2024-01-01')).toBe(true);
    expect(isIsoDate('2024-12-31')).toBe(true);
    expect(isIsoDate('2024-04-30')).toBe(true);
    expect(isIsoDate('0001-01-01')).toBe(true);
  });

  it('understands leap years', () => {
    expect(isIsoDate('2024-02-29')).toBe(true);
    expect(isIsoDate('2000-02-29')).toBe(true);
    expect(isIsoDate('2023-02-29')).toBe(false);
    expect(isIsoDate('1900-02-29')).toBe(false);
    expect(isIsoDate('2100-02-29')).toBe(false);
  });

  it('rejects invalid months and days', () => {
    expect(isIsoDate('2024-13-01')).toBe(false);
    expect(isIsoDate('2024-00-10')).toBe(false);
    expect(isIsoDate('2024-04-31')).toBe(false);
    expect(isIsoDate('2024-01-00')).toBe(false);
    expect(isIsoDate('2024-01-32')).toBe(false);
  });

  it('rejects anything that is not strictly YYYY-MM-DD', () => {
    expect(isIsoDate('2024-1-1')).toBe(false);
    expect(isIsoDate('2024-01-01T00:00:00Z')).toBe(false);
    expect(isIsoDate(' 2024-01-01')).toBe(false);
    expect(isIsoDate('01/01/2024')).toBe(false);
    expect(isIsoDate('')).toBe(false);
    expect(isIsoDate(20240101)).toBe(false);
    expect(isIsoDate(null)).toBe(false);
    expect(isIsoDate(undefined)).toBe(false);
    expect(isIsoDate(new Date())).toBe(false);
  });
});

describe('parse / make / toIsoDate', () => {
  it('parses to a UTC midnight Date and back', () => {
    const d = parseIsoDate('2024-03-05');
    expect(d.getUTCFullYear()).toBe(2024);
    expect(d.getUTCMonth()).toBe(2);
    expect(d.getUTCDate()).toBe(5);
    expect(d.getUTCHours()).toBe(0);
    expect(toIsoDate(d)).toBe('2024-03-05');
  });

  it('throws on invalid input', () => {
    expect(() => parseIsoDate('2024-02-30')).toThrow(RangeError);
    expect(() => parseIsoDate('nope')).toThrow(/Invalid ISO date/);
  });

  it('makes dates with zero padding and normalises overflow', () => {
    expect(makeIsoDate(2024, 3, 5)).toBe('2024-03-05');
    expect(makeIsoDate(2024, 2, 30)).toBe('2024-03-01');
    expect(makeIsoDate(2024, 13, 1)).toBe('2025-01-01');
  });

  it('exposes date parts', () => {
    expect(dateParts('2024-03-05')).toEqual({ year: 2024, month: 3, day: 5 });
  });
});

describe('leap years and month lengths', () => {
  it('follows the Gregorian rules', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2000)).toBe(true);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2023)).toBe(false);
  });

  it('knows the days in each month', () => {
    expect(daysInMonth(2024, 1)).toBe(31);
    expect(daysInMonth(2024, 2)).toBe(29);
    expect(daysInMonth(2023, 2)).toBe(28);
    expect(daysInMonth(2024, 4)).toBe(30);
    expect(daysInMonth(2024, 12)).toBe(31);
  });
});

describe('addDays / addMonths / addYears / diffDays', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01');
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29');
    expect(addDays('2023-03-01', -1)).toBe('2023-02-28');
    expect(addDays('2024-01-15', 0)).toBe('2024-01-15');
    expect(addDays('2024-01-01', 366)).toBe('2025-01-01');
  });

  it('clamps the day when adding months', () => {
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29');
    expect(addMonths('2023-01-31', 1)).toBe('2023-02-28');
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29');
    expect(addMonths('2024-05-31', 1)).toBe('2024-06-30');
    expect(addMonths('2024-01-30', 1)).toBe('2024-02-29');
  });

  it('adds months across years in both directions', () => {
    expect(addMonths('2024-12-15', 1)).toBe('2025-01-15');
    expect(addMonths('2024-01-15', -1)).toBe('2023-12-15');
    expect(addMonths('2024-01-15', -2)).toBe('2023-11-15');
    expect(addMonths('2024-05-31', 13)).toBe('2025-06-30');
    expect(addMonths('2024-01-31', -12)).toBe('2023-01-31');
    expect(addMonths('2024-06-15', 0)).toBe('2024-06-15');
  });

  it('adds years with Feb 29 clamping', () => {
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
    expect(addYears('2024-02-29', 4)).toBe('2028-02-29');
    expect(addYears('2024-06-15', -1)).toBe('2023-06-15');
  });

  it('measures whole days between dates', () => {
    expect(diffDays('2024-01-01', '2024-01-31')).toBe(30);
    expect(diffDays('2024-01-31', '2024-01-01')).toBe(-30);
    expect(diffDays('2024-01-01', '2024-01-01')).toBe(0);
    expect(diffDays('2024-02-28', '2024-03-01')).toBe(2);
    expect(diffDays('2023-02-28', '2023-03-01')).toBe(1);
    expect(diffDays('2023-01-01', '2024-01-01')).toBe(365);
    expect(diffDays('2024-01-01', '2025-01-01')).toBe(366);
  });

  it('reports days overdue relative to today', () => {
    expect(daysOverdue('2024-03-01', '2024-03-11')).toBe(10);
    expect(daysOverdue('2024-03-11', '2024-03-01')).toBe(-10);
    expect(daysOverdue('2024-03-11', '2024-03-11')).toBe(0);
  });
});

describe('comparisons', () => {
  it('compares ISO strings lexically', () => {
    expect(compareIsoDates('2024-01-01', '2024-01-02')).toBe(-1);
    expect(compareIsoDates('2024-01-02', '2024-01-01')).toBe(1);
    expect(compareIsoDates('2024-01-01', '2024-01-01')).toBe(0);
    expect(isBefore('2024-01-01', '2024-01-02')).toBe(true);
    expect(isBefore('2024-01-02', '2024-01-02')).toBe(false);
    expect(isAfter('2024-01-03', '2024-01-02')).toBe(true);
    expect(isAfter('2024-01-02', '2024-01-02')).toBe(false);
    expect(isSameOrBefore('2024-01-02', '2024-01-02')).toBe(true);
    expect(isSameOrBefore('2024-01-03', '2024-01-02')).toBe(false);
  });

  it('finds min and max', () => {
    expect(minDate('2024-05-01', '2023-12-31', '2024-01-01')).toBe('2023-12-31');
    expect(maxDate('2024-05-01', '2023-12-31', '2024-01-01')).toBe('2024-05-01');
    expect(minDate('2024-05-01')).toBe('2024-05-01');
  });

  it('checks inclusive membership with optional bounds', () => {
    expect(isWithin('2024-01-15', '2024-01-01', '2024-01-31')).toBe(true);
    expect(isWithin('2024-01-01', '2024-01-01', '2024-01-31')).toBe(true);
    expect(isWithin('2024-01-31', '2024-01-01', '2024-01-31')).toBe(true);
    expect(isWithin('2024-02-01', '2024-01-01', '2024-01-31')).toBe(false);
    expect(isWithin('2023-12-31', '2024-01-01', '2024-01-31')).toBe(false);
    expect(isWithin('1999-01-01', null, '2024-01-31')).toBe(true);
    expect(isWithin('2999-01-01', '2024-01-01', null)).toBe(true);
    expect(isWithin('2999-01-01', null, null)).toBe(true);
  });
});

describe('period boundaries', () => {
  it('finds month and year bounds', () => {
    expect(startOfMonth('2024-02-15')).toBe('2024-02-01');
    expect(endOfMonth('2024-02-15')).toBe('2024-02-29');
    expect(endOfMonth('2023-02-15')).toBe('2023-02-28');
    expect(startOfYear('2024-07-04')).toBe('2024-01-01');
    expect(endOfYear('2024-07-04')).toBe('2024-12-31');
  });

  it('finds quarter bounds', () => {
    expect(startOfQuarter('2024-05-17')).toBe('2024-04-01');
    expect(endOfQuarter('2024-05-17')).toBe('2024-06-30');
    expect(startOfQuarter('2024-03-31')).toBe('2024-01-01');
    expect(endOfQuarter('2024-01-01')).toBe('2024-03-31');
    expect(startOfQuarter('2024-11-02')).toBe('2024-10-01');
    expect(endOfQuarter('2024-11-02')).toBe('2024-12-31');
    expect(endOfQuarter('2024-08-31')).toBe('2024-09-30');
  });

  it('builds ranges for a period around today', () => {
    expect(rangeForPeriod('2024-05-17', 'month')).toEqual({ from: '2024-05-01', to: '2024-05-31' });
    expect(rangeForPeriod('2024-05-17', 'quarter')).toEqual({ from: '2024-04-01', to: '2024-06-30' });
    expect(rangeForPeriod('2024-05-17', 'year')).toEqual({ from: '2024-01-01', to: '2024-12-31' });
    expect(monthRange(2024, 2)).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(monthRange(2024, 12)).toEqual({ from: '2024-12-01', to: '2024-12-31' });
  });
});

describe('weeks (Monday start)', () => {
  it('uses ISO weekday numbering', () => {
    expect(isoWeekday('2024-01-01')).toBe(1); // Monday
    expect(isoWeekday('2024-01-06')).toBe(6); // Saturday
    expect(isoWeekday('2024-01-07')).toBe(7); // Sunday
    expect(isoWeekday('2024-03-05')).toBe(2); // Tuesday
  });

  it('flags weekends', () => {
    expect(isWeekend('2024-01-05')).toBe(false);
    expect(isWeekend('2024-01-06')).toBe(true);
    expect(isWeekend('2024-01-07')).toBe(true);
    expect(isWeekend('2024-01-08')).toBe(false);
  });

  it('starts weeks on Monday and ends on Sunday', () => {
    expect(startOfWeek('2024-01-01')).toBe('2024-01-01');
    expect(startOfWeek('2024-01-07')).toBe('2024-01-01');
    expect(startOfWeek('2024-01-03')).toBe('2024-01-01');
    expect(startOfWeek('2024-03-01')).toBe('2024-02-26');
    expect(endOfWeek('2024-01-03')).toBe('2024-01-07');
    expect(endOfWeek('2024-01-07')).toBe('2024-01-07');
    expect(endOfWeek('2024-12-30')).toBe('2025-01-05');
  });

  it('lists the seven days of a week', () => {
    const week = weekOf('2024-01-03');
    expect(week).toHaveLength(7);
    expect(week[0]).toBe('2024-01-01');
    expect(week[6]).toBe('2024-01-07');
    expect(week).toEqual(eachDay({ from: '2024-01-01', to: '2024-01-07' }));
  });
});

describe('previousRange', () => {
  it('steps back a whole month', () => {
    expect(previousRange({ from: '2024-03-01', to: '2024-03-31' })).toEqual({ from: '2024-02-01', to: '2024-02-29' });
    expect(previousRange({ from: '2024-01-01', to: '2024-01-31' })).toEqual({ from: '2023-12-01', to: '2023-12-31' });
    expect(previousRange({ from: '2024-02-01', to: '2024-02-29' })).toEqual({ from: '2024-01-01', to: '2024-01-31' });
  });

  it('steps back a whole quarter and year', () => {
    expect(previousRange({ from: '2024-04-01', to: '2024-06-30' })).toEqual({ from: '2024-01-01', to: '2024-03-31' });
    expect(previousRange({ from: '2024-01-01', to: '2024-03-31' })).toEqual({ from: '2023-10-01', to: '2023-12-31' });
    expect(previousRange({ from: '2024-01-01', to: '2024-12-31' })).toEqual({ from: '2023-01-01', to: '2023-12-31' });
  });

  it('steps back by the same number of days for arbitrary ranges', () => {
    expect(previousRange({ from: '2024-03-10', to: '2024-03-19' })).toEqual({ from: '2024-02-29', to: '2024-03-09' });
    expect(previousRange({ from: '2024-03-10', to: '2024-03-10' })).toEqual({ from: '2024-03-09', to: '2024-03-09' });
    expect(previousRange({ from: '2024-03-01', to: '2024-03-15' })).toEqual({ from: '2024-02-15', to: '2024-02-29' });
  });

  it('counts months between month-aligned bounds', () => {
    expect(monthsBetween('2024-01-01', '2024-03-31')).toBe(3);
    expect(monthsBetween('2023-11-01', '2024-02-29')).toBe(4);
    expect(monthsBetween('2024-05-01', '2024-05-31')).toBe(1);
  });
});

describe('fiscalYearRange', () => {
  it('matches the calendar year when the fiscal year starts in January', () => {
    expect(fiscalYearRange('2024-05-17', 1)).toEqual({ from: '2024-01-01', to: '2024-12-31' });
    expect(fiscalYearRange('2024-01-01', 1)).toEqual({ from: '2024-01-01', to: '2024-12-31' });
    expect(fiscalYearRange('2024-12-31', 1)).toEqual({ from: '2024-01-01', to: '2024-12-31' });
  });

  it('handles an April start across the year boundary', () => {
    expect(fiscalYearRange('2024-05-17', 4)).toEqual({ from: '2024-04-01', to: '2025-03-31' });
    expect(fiscalYearRange('2024-04-01', 4)).toEqual({ from: '2024-04-01', to: '2025-03-31' });
    expect(fiscalYearRange('2024-03-31', 4)).toEqual({ from: '2023-04-01', to: '2024-03-31' });
    expect(fiscalYearRange('2024-02-10', 4)).toEqual({ from: '2023-04-01', to: '2024-03-31' });
  });

  it('handles a July start', () => {
    expect(fiscalYearRange('2024-07-01', 7)).toEqual({ from: '2024-07-01', to: '2025-06-30' });
    expect(fiscalYearRange('2024-06-30', 7)).toEqual({ from: '2023-07-01', to: '2024-06-30' });
    expect(fiscalYearRange('2025-01-15', 7)).toEqual({ from: '2024-07-01', to: '2025-06-30' });
  });

  it('handles a December start', () => {
    expect(fiscalYearRange('2024-01-05', 12)).toEqual({ from: '2023-12-01', to: '2024-11-30' });
    expect(fiscalYearRange('2024-12-05', 12)).toEqual({ from: '2024-12-01', to: '2025-11-30' });
  });
});

describe('splitByMonth / splitByWeek / eachDay', () => {
  it('splits a range into month buckets with partial ends and labels', () => {
    const buckets = splitByMonth({ from: '2024-01-15', to: '2024-03-10' });
    expect(buckets).toEqual([
      { from: '2024-01-15', to: '2024-01-31', label: 'Jan 24' },
      { from: '2024-02-01', to: '2024-02-29', label: 'Feb 24' },
      { from: '2024-03-01', to: '2024-03-10', label: 'Mar 24' },
    ]);
  });

  it('covers the whole range contiguously', () => {
    const range = { from: '2023-11-20', to: '2024-02-05' };
    const buckets = splitByMonth(range);
    expect(buckets.map((b) => b.label)).toEqual(['Nov 23', 'Dec 23', 'Jan 24', 'Feb 24']);
    expect(buckets[0]?.from).toBe(range.from);
    expect(buckets[buckets.length - 1]?.to).toBe(range.to);
    for (let i = 1; i < buckets.length; i++) {
      expect(buckets[i]?.from).toBe(addDays(buckets[i - 1]?.to ?? '', 1));
    }
    expect(splitByMonth({ from: '2024-05-01', to: '2024-05-31' })).toHaveLength(1);
    expect(splitByMonth({ from: '2024-05-10', to: '2024-05-01' })).toEqual([]);
  });

  it('splits into Monday-based weeks labelled by their first day', () => {
    const buckets = splitByWeek({ from: '2024-01-03', to: '2024-01-16' });
    expect(buckets).toEqual([
      { from: '2024-01-03', to: '2024-01-07', label: '3 Jan' },
      { from: '2024-01-08', to: '2024-01-14', label: '8 Jan' },
      { from: '2024-01-15', to: '2024-01-16', label: '15 Jan' },
    ]);
    const full = splitByWeek({ from: '2024-01-01', to: '2024-01-28' });
    expect(full).toHaveLength(4);
    expect(full.every((b) => diffDays(b.from, b.to) === 6)).toBe(true);
  });

  it('lists every day of a range', () => {
    expect(eachDay({ from: '2024-02-27', to: '2024-03-01' })).toEqual(['2024-02-27', '2024-02-28', '2024-02-29', '2024-03-01']);
    expect(eachDay({ from: '2024-02-27', to: '2024-02-27' })).toEqual(['2024-02-27']);
    expect(eachDay({ from: '2024-02-28', to: '2024-02-27' })).toEqual([]);
  });
});

describe('calendarGrid', () => {
  it('always produces 6 rows of 7 cells', () => {
    for (const [y, m] of [
      [2024, 1],
      [2024, 2],
      [2024, 9],
      [2023, 2],
      [2025, 6],
    ] as const) {
      const grid = calendarGrid(y, m);
      expect(grid).toHaveLength(6);
      for (const row of grid) expect(row).toHaveLength(7);
    }
  });

  it('starts on the Monday on or before the 1st', () => {
    const jan = calendarGrid(2024, 1); // Jan 1 2024 is a Monday
    expect(jan[0]?.[0]).toEqual({ date: '2024-01-01', day: 1, inMonth: true, weekend: false });
    expect(jan[4]?.[2]).toEqual({ date: '2024-01-31', day: 31, inMonth: true, weekend: false });
    expect(jan[4]?.[3]).toEqual({ date: '2024-02-01', day: 1, inMonth: false, weekend: false });
    expect(jan[5]?.[6]?.date).toBe('2024-02-11');

    const mar = calendarGrid(2024, 3); // Mar 1 2024 is a Friday
    expect(mar[0]?.[0]).toMatchObject({ date: '2024-02-26', day: 26, inMonth: false });
    expect(mar[0]?.[4]).toMatchObject({ date: '2024-03-01', day: 1, inMonth: true });
    expect(mar[5]?.[6]?.date).toBe('2024-04-07');

    const sep = calendarGrid(2024, 9); // Sep 1 2024 is a Sunday
    expect(sep[0]?.[0]?.date).toBe('2024-08-26');
    expect(sep[0]?.[6]).toMatchObject({ date: '2024-09-01', inMonth: true, weekend: true });
  });

  it('flags in-month cells and weekends by column', () => {
    const grid = calendarGrid(2024, 2);
    const cells = grid.flat();
    expect(cells.filter((c) => c.inMonth)).toHaveLength(29);
    expect(cells.filter((c) => c.inMonth).map((c) => c.day)).toEqual(Array.from({ length: 29 }, (_, i) => i + 1));
    for (const row of grid) {
      row.forEach((cell, col) => {
        expect(cell.weekend).toBe(col >= 5);
        expect(cell.weekend).toBe(isWeekend(cell.date));
      });
    }
    // consecutive days
    for (let i = 1; i < cells.length; i++) {
      expect(cells[i]?.date).toBe(addDays(cells[i - 1]?.date ?? '', 1));
    }
  });
});

describe('formatDate', () => {
  it('supports every style', () => {
    expect(formatDate('2024-03-05')).toBe('5 Mar 2024');
    expect(formatDate('2024-03-05', 'medium')).toBe('5 Mar 2024');
    expect(formatDate('2024-03-05', 'short')).toBe('5 Mar');
    expect(formatDate('2024-03-05', 'long')).toBe('Tuesday, 5 March 2024');
    expect(formatDate('2024-03-05', 'numeric')).toBe('05/03/2024');
    expect(formatDate('2024-03-05', 'month')).toBe('March 2024');
    expect(formatDate('2024-12-25', 'long')).toBe('Wednesday, 25 December 2024');
  });

  it('renders a dash for missing values and echoes unparseable ones', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('formats date ranges according to their span', () => {
    expect(formatDateRange({ from: '2024-03-05', to: '2024-03-05' })).toBe('5 Mar 2024');
    expect(formatDateRange({ from: '2024-03-01', to: '2024-03-15' })).toBe('1–15 Mar 2024');
    expect(formatDateRange({ from: '2024-01-01', to: '2024-03-15' })).toBe('1 Jan – 15 Mar 2024');
    expect(formatDateRange({ from: '2023-12-15', to: '2024-01-15' })).toBe('15 Dec 2023 – 15 Jan 2024');
  });

  it('formats timestamps in UTC', () => {
    expect(formatDateTime('2024-03-05T14:07:00.000Z')).toBe('5 Mar 2024, 14:07');
    expect(formatDateTime('2024-03-05T09:05:00Z')).toBe('5 Mar 2024, 09:05');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('garbage')).toBe('garbage');
  });

  it('exposes month and weekday names', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_SHORT).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']);
    expect(WEEKDAY_NAMES[0]).toBe('Monday');
    expect(WEEKDAY_SHORT).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
  });
});

describe('formatRelative', () => {
  const today = '2024-06-30';
  const rel = (days: number) => formatRelative(addDays(today, days), today);

  it('names the nearest days', () => {
    expect(rel(0)).toBe('today');
    expect(rel(1)).toBe('tomorrow');
    expect(rel(-1)).toBe('yesterday');
  });

  it('counts days under two weeks', () => {
    expect(rel(2)).toBe('in 2 days');
    expect(rel(-5)).toBe('5 days ago');
    expect(rel(7)).toBe('in 7 days');
    expect(rel(13)).toBe('in 13 days');
    expect(rel(-13)).toBe('13 days ago');
  });

  it('counts weeks from two weeks to two months', () => {
    expect(rel(14)).toBe('in 2 weeks');
    expect(rel(-14)).toBe('2 weeks ago');
    expect(rel(20)).toBe('in 3 weeks');
    expect(rel(45)).toBe('in 6 weeks');
    expect(rel(-59)).toBe('8 weeks ago');
  });

  it('counts months up to a year', () => {
    expect(rel(60)).toBe('in 2 months');
    expect(rel(-90)).toBe('3 months ago');
    expect(rel(364)).toBe('in 12 months');
  });

  it('counts years beyond that, with singular wording', () => {
    expect(rel(365)).toBe('in 1 year');
    expect(rel(-400)).toBe('1 year ago');
    expect(rel(730)).toBe('in 2 years');
    expect(rel(-800)).toBe('2 years ago');
  });
});

describe('month keys', () => {
  it('extracts, parses and formats YYYY-MM keys', () => {
    expect(monthKey('2024-03-15')).toBe('2024-03');
    expect(parseMonthKey('2024-12')).toEqual({ year: 2024, month: 12 });
    expect(parseMonthKey('2024-13')).toBeNull();
    expect(parseMonthKey('2024-00')).toBeNull();
    expect(parseMonthKey('2024-3')).toBeNull();
    expect(parseMonthKey('2024-03-01')).toBeNull();
    expect(formatMonthKey('2024-03')).toBe('March 2024');
    expect(formatMonthKey('bad')).toBe('bad');
  });

  it('shifts keys across year boundaries', () => {
    expect(shiftMonthKey('2024-12', 1)).toBe('2025-01');
    expect(shiftMonthKey('2024-01', -1)).toBe('2023-12');
    expect(shiftMonthKey('2024-06', 0)).toBe('2024-06');
    expect(shiftMonthKey('2024-06', 18)).toBe('2025-12');
    expect(shiftMonthKey('bad', 1)).toBe('bad');
  });
});

describe('timestamps', () => {
  it('extracts the date part of a timestamp', () => {
    expect(isoDateFromDateTime('2024-03-01T10:00:00.000Z')).toBe('2024-03-01');
  });

  it('builds a timestamp at a fixed UTC time', () => {
    expect(isoDateTimeAt('2024-03-05')).toBe('2024-03-05T09:00:00.000Z');
    expect(isoDateTimeAt('2024-03-05', 17, 30)).toBe('2024-03-05T17:30:00.000Z');
    expect(isoDateTimeAt('2024-03-05', 0)).toBe('2024-03-05T00:00:00.000Z');
  });
});
