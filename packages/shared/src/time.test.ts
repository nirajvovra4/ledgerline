import { describe, expect, it } from 'vitest';
import {
  billableAmount,
  groupTimeByDay,
  minutesToDuration,
  parseDuration,
  roundMinutesUp,
  sumMinutes,
  utilisationBp,
} from './time';

describe('minutesToDuration', () => {
  it('formats the short style', () => {
    expect(minutesToDuration(0)).toBe('0m');
    expect(minutesToDuration(45)).toBe('45m');
    expect(minutesToDuration(60)).toBe('1h');
    expect(minutesToDuration(90)).toBe('1h 30m');
    expect(minutesToDuration(1440)).toBe('24h');
    expect(minutesToDuration(61, 'short')).toBe('1h 1m');
  });

  it('formats the clock style with zero-padded minutes', () => {
    expect(minutesToDuration(90, 'clock')).toBe('1:30');
    expect(minutesToDuration(5, 'clock')).toBe('0:05');
    expect(minutesToDuration(0, 'clock')).toBe('0:00');
    expect(minutesToDuration(600, 'clock')).toBe('10:00');
  });

  it('formats the decimal style with two decimals', () => {
    expect(minutesToDuration(90, 'decimal')).toBe('1.50h');
    expect(minutesToDuration(0, 'decimal')).toBe('0.00h');
    expect(minutesToDuration(100, 'decimal')).toBe('1.67h');
    expect(minutesToDuration(45, 'decimal')).toBe('0.75h');
  });

  it('keeps a sign for negative durations and rounds fractional minutes', () => {
    expect(minutesToDuration(-90)).toBe('-1h 30m');
    expect(minutesToDuration(-30)).toBe('-30m');
    expect(minutesToDuration(-90, 'clock')).toBe('-1:30');
    expect(minutesToDuration(-90, 'decimal')).toBe('-1.50h');
    expect(minutesToDuration(89.6)).toBe('1h 30m');
    expect(minutesToDuration(89.4)).toBe('1h 29m');
  });
});

describe('parseDuration', () => {
  it('parses every documented form', () => {
    expect(parseDuration('1h 30m')).toBe(90);
    expect(parseDuration('1h30')).toBe(90);
    expect(parseDuration('90m')).toBe(90);
    expect(parseDuration('1.5')).toBe(90);
    expect(parseDuration('1.5h')).toBe(90);
    expect(parseDuration('1:30')).toBe(90);
    expect(parseDuration('0:45')).toBe(45);
    expect(parseDuration('2')).toBe(120);
  });

  it('is tolerant of case and whitespace', () => {
    expect(parseDuration('1H 30M')).toBe(90);
    expect(parseDuration('  2h ')).toBe(120);
    expect(parseDuration('1 h 30 m')).toBe(90);
    expect(parseDuration('1h30m')).toBe(90);
  });

  it('handles edge values', () => {
    expect(parseDuration('0')).toBe(0);
    expect(parseDuration('0m')).toBe(0);
    expect(parseDuration('1:5')).toBe(65);
    expect(parseDuration('1h5')).toBe(65);
    expect(parseDuration('1.25')).toBe(75);
    expect(parseDuration('0.1')).toBe(6);
    expect(parseDuration('90')).toBe(5400);
    expect(parseDuration('10:00')).toBe(600);
    expect(parseDuration('2.5h')).toBe(150);
  });

  it('rejects invalid input', () => {
    expect(parseDuration('')).toBeNull();
    expect(parseDuration('   ')).toBeNull();
    expect(parseDuration('abc')).toBeNull();
    expect(parseDuration('1:60')).toBeNull();
    expect(parseDuration('2:75')).toBeNull();
    expect(parseDuration('1:300')).toBeNull();
    expect(parseDuration('-1')).toBeNull();
    expect(parseDuration('1h 30m 10s')).toBeNull();
    expect(parseDuration('h')).toBeNull();
    expect(parseDuration('30m1h')).toBeNull();
    expect(parseDuration(':30')).toBeNull();
    expect(parseDuration('1.5:30')).toBeNull();
    expect(parseDuration('1.5m')).toBeNull();
    expect(parseDuration('1..5')).toBeNull();
  });
});

describe('billableAmount', () => {
  it('bills whole and partial hours', () => {
    expect(billableAmount(60, 10000)).toBe(10000);
    expect(billableAmount(30, 10000)).toBe(5000);
    expect(billableAmount(90, 10000)).toBe(15000);
    expect(billableAmount(0, 10000)).toBe(0);
    expect(billableAmount(15, 12345)).toBe(3086); // 3086.25
    expect(billableAmount(45, 10001)).toBe(7501); // 7500.75
    expect(billableAmount(1, 10000)).toBe(167); // 1/60 -> 0.0167 -> 166.67
  });

  it('rounds half-even', () => {
    expect(billableAmount(30, 1)).toBe(0); // 0.5 -> 0
    expect(billableAmount(30, 3)).toBe(2); // 1.5 -> 2
    expect(billableAmount(30, 5)).toBe(2); // 2.5 -> 2
  });

  it('rejects fractional rates', () => {
    expect(() => billableAmount(60, 100.5)).toThrow(TypeError);
  });
});

describe('groupTimeByDay / sumMinutes', () => {
  const entries = [
    { id: 'a', date: '2024-06-03', minutes: 60, billable: true },
    { id: 'b', date: '2024-06-03', minutes: 30, billable: false },
    { id: 'c', date: '2024-06-04', minutes: 45, billable: true },
    { id: 'd', date: '2024-06-03', minutes: 15, billable: true },
  ];

  it('groups entries by date preserving first-seen order', () => {
    const map = groupTimeByDay(entries);
    expect([...map.keys()]).toEqual(['2024-06-03', '2024-06-04']);
    expect(map.get('2024-06-03')).toEqual({ minutes: 105, billableMinutes: 75, entries: [entries[0], entries[1], entries[3]] });
    expect(map.get('2024-06-04')).toEqual({ minutes: 45, billableMinutes: 45, entries: [entries[2]] });
  });

  it('returns an empty map for no entries', () => {
    expect(groupTimeByDay([]).size).toBe(0);
  });

  it('sums minutes', () => {
    expect(sumMinutes(entries)).toBe(150);
    expect(sumMinutes([])).toBe(0);
  });
});

describe('utilisationBp', () => {
  it('computes billable share in basis points', () => {
    expect(utilisationBp(30, 60)).toBe(5000);
    expect(utilisationBp(60, 60)).toBe(10000);
    expect(utilisationBp(0, 60)).toBe(0);
    expect(utilisationBp(1, 3)).toBe(3333);
    expect(utilisationBp(2, 3)).toBe(6667);
  });

  it('is zero without any logged time', () => {
    expect(utilisationBp(0, 0)).toBe(0);
    expect(utilisationBp(60, 0)).toBe(0);
    expect(utilisationBp(60, -1)).toBe(0);
  });
});

describe('roundMinutesUp', () => {
  it('rounds up to the increment', () => {
    expect(roundMinutesUp(1, 15)).toBe(15);
    expect(roundMinutesUp(15, 15)).toBe(15);
    expect(roundMinutesUp(16, 15)).toBe(30);
    expect(roundMinutesUp(0, 15)).toBe(0);
    expect(roundMinutesUp(61, 6)).toBe(66);
    expect(roundMinutesUp(59, 60)).toBe(60);
  });

  it('leaves minutes alone for a non-positive increment', () => {
    expect(roundMinutesUp(7, 0)).toBe(7);
    expect(roundMinutesUp(7, -5)).toBe(7);
  });
});
