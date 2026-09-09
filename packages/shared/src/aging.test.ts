import { describe, expect, it } from 'vitest';
import { agingBucketFor, buildAgingReport, emptyBuckets } from './aging';
import { AGING_BUCKETS } from './constants';
import { addDays } from './dates';

const asOf = '2024-06-30';
const dueDaysAgo = (n: number) => addDays(asOf, -n);

describe('agingBucketFor', () => {
  it('assigns each boundary to the right bucket', () => {
    expect(agingBucketFor(dueDaysAgo(-10), asOf)).toBe('current'); // due in the future
    expect(agingBucketFor(dueDaysAgo(0), asOf)).toBe('current');
    expect(agingBucketFor(dueDaysAgo(1), asOf)).toBe('d1_30');
    expect(agingBucketFor(dueDaysAgo(30), asOf)).toBe('d1_30');
    expect(agingBucketFor(dueDaysAgo(31), asOf)).toBe('d31_60');
    expect(agingBucketFor(dueDaysAgo(60), asOf)).toBe('d31_60');
    expect(agingBucketFor(dueDaysAgo(61), asOf)).toBe('d61_90');
    expect(agingBucketFor(dueDaysAgo(90), asOf)).toBe('d61_90');
    expect(agingBucketFor(dueDaysAgo(91), asOf)).toBe('d90_plus');
    expect(agingBucketFor(dueDaysAgo(365), asOf)).toBe('d90_plus');
  });

  it('agrees with the AGING_BUCKETS definitions', () => {
    for (const bucket of AGING_BUCKETS) {
      if (bucket.minDays > 0)
        expect(agingBucketFor(dueDaysAgo(bucket.minDays), asOf)).toBe(bucket.key);
      if (bucket.maxDays !== null)
        expect(agingBucketFor(dueDaysAgo(bucket.maxDays), asOf)).toBe(bucket.key);
    }
  });

  it('starts from an all-zero bucket map', () => {
    expect(emptyBuckets()).toEqual({ current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 });
    expect(emptyBuckets()).not.toBe(emptyBuckets());
  });
});

describe('buildAgingReport', () => {
  const open = [
    { clientId: 'a', clientName: 'Acme', dueDate: dueDaysAgo(10), balanceCents: 1000 },
    { clientId: 'a', clientName: 'Acme', dueDate: dueDaysAgo(-5), balanceCents: 500 },
    { clientId: 'b', clientName: 'Bolt', dueDate: dueDaysAgo(45), balanceCents: 3000 },
    { clientId: 'c', clientName: 'Cog', dueDate: dueDaysAgo(200), balanceCents: 0 },
    { clientId: 'd', clientName: 'Dyn', dueDate: dueDaysAgo(200), balanceCents: -100 },
    { clientId: 'b', clientName: 'Bolt', dueDate: dueDaysAgo(100), balanceCents: 200 },
  ];

  it('totals every bucket and the whole report', () => {
    const report = buildAgingReport(open, asOf);
    expect(report.asOf).toBe(asOf);
    expect(report.totalCents).toBe(4700);
    expect(report.buckets).toEqual([
      { bucket: 'current', label: 'Current', amountCents: 500, count: 1 },
      { bucket: 'd1_30', label: '1–30 days', amountCents: 1000, count: 1 },
      { bucket: 'd31_60', label: '31–60 days', amountCents: 3000, count: 1 },
      { bucket: 'd61_90', label: '61–90 days', amountCents: 0, count: 0 },
      { bucket: 'd90_plus', label: '90+ days', amountCents: 200, count: 1 },
    ]);
    expect(report.buckets.reduce((s, b) => s + b.amountCents, 0)).toBe(report.totalCents);
  });

  it('builds one row per client ordered by total descending', () => {
    const { rows } = buildAgingReport(open, asOf);
    expect(rows.map((r) => r.clientId)).toEqual(['b', 'a']);
    expect(rows[0]).toEqual({
      clientId: 'b',
      clientName: 'Bolt',
      buckets: { current: 0, d1_30: 0, d31_60: 3000, d61_90: 0, d90_plus: 200 },
      totalCents: 3200,
      oldestDays: 100,
    });
    expect(rows[1]).toEqual({
      clientId: 'a',
      clientName: 'Acme',
      buckets: { current: 500, d1_30: 1000, d31_60: 0, d61_90: 0, d90_plus: 0 },
      totalCents: 1500,
      oldestDays: 10,
    });
  });

  it('ignores zero and negative balances entirely', () => {
    const { rows, totalCents } = buildAgingReport(open, asOf);
    expect(rows.find((r) => r.clientId === 'c')).toBeUndefined();
    expect(rows.find((r) => r.clientId === 'd')).toBeUndefined();
    expect(totalCents).toBe(4700);
  });

  it('breaks ties on total by client name', () => {
    const { rows } = buildAgingReport(
      [
        { clientId: 'z', clientName: 'Zeta', dueDate: asOf, balanceCents: 100 },
        { clientId: 'm', clientName: 'Mu', dueDate: asOf, balanceCents: 100 },
        { clientId: 'a', clientName: 'Alpha', dueDate: asOf, balanceCents: 100 },
      ],
      asOf,
    );
    expect(rows.map((r) => r.clientName)).toEqual(['Alpha', 'Mu', 'Zeta']);
  });

  it('never reports negative oldestDays for invoices not yet due', () => {
    const { rows } = buildAgingReport(
      [{ clientId: 'a', clientName: 'A', dueDate: dueDaysAgo(-30), balanceCents: 10 }],
      asOf,
    );
    expect(rows[0]?.oldestDays).toBe(0);
  });

  it('returns an empty report for no open invoices', () => {
    const report = buildAgingReport([], asOf);
    expect(report.rows).toEqual([]);
    expect(report.totalCents).toBe(0);
    expect(report.buckets.map((b) => b.bucket)).toEqual(AGING_BUCKETS.map((b) => b.key));
    expect(report.buckets.every((b) => b.amountCents === 0 && b.count === 0)).toBe(true);
  });
});
