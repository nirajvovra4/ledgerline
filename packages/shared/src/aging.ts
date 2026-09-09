import { AGING_BUCKETS } from './constants';
import { diffDays } from './dates';
import type { AgingBucketKey, AgingClientRow, AgingReportDto, Cents, IsoDate } from './types';

export function agingBucketFor(dueDate: IsoDate, asOf: IsoDate): AgingBucketKey {
  const days = diffDays(dueDate, asOf);
  if (days <= 0) return 'current';
  if (days <= 30) return 'd1_30';
  if (days <= 60) return 'd31_60';
  if (days <= 90) return 'd61_90';
  return 'd90_plus';
}

export function emptyBuckets(): Record<AgingBucketKey, Cents> {
  return { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
}

export interface AgingInput {
  clientId: string;
  clientName: string;
  dueDate: IsoDate;
  balanceCents: Cents;
}

/** Build the receivables aging report from open invoice balances. */
export function buildAgingReport(open: AgingInput[], asOf: IsoDate): AgingReportDto {
  const byClient = new Map<string, AgingClientRow>();
  const totals = emptyBuckets();
  const counts: Record<AgingBucketKey, number> = { current: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
  let totalCents = 0;

  for (const inv of open) {
    if (inv.balanceCents <= 0) continue;
    const bucket = agingBucketFor(inv.dueDate, asOf);
    const days = Math.max(0, diffDays(inv.dueDate, asOf));
    let row = byClient.get(inv.clientId);
    if (!row) {
      row = { clientId: inv.clientId, clientName: inv.clientName, buckets: emptyBuckets(), totalCents: 0, oldestDays: 0 };
      byClient.set(inv.clientId, row);
    }
    row.buckets[bucket] += inv.balanceCents;
    row.totalCents += inv.balanceCents;
    row.oldestDays = Math.max(row.oldestDays, days);
    totals[bucket] += inv.balanceCents;
    counts[bucket] += 1;
    totalCents += inv.balanceCents;
  }

  const rows = [...byClient.values()].sort((a, b) => b.totalCents - a.totalCents || a.clientName.localeCompare(b.clientName));
  return {
    asOf,
    buckets: AGING_BUCKETS.map((b) => ({ bucket: b.key, label: b.label, amountCents: totals[b.key], count: counts[b.key] })),
    rows,
    totalCents,
  };
}
