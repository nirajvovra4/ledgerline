import { applyBp } from './money';
import type { BasisPoints, Cents } from './types';

export interface TaxableLine {
  netCents: Cents;
  taxRateId: string | null;
  taxRateBp: BasisPoints;
  taxRateName?: string;
}

export function taxForLine(netCents: Cents, rateBp: BasisPoints): Cents {
  if (rateBp === 0) return 0;
  return applyBp(netCents, rateBp);
}

export interface TaxSummaryRow {
  taxRateId: string | null;
  name: string;
  rateBp: BasisPoints;
  netCents: Cents;
  taxCents: Cents;
}

/** Group lines by tax rate and total the net and tax for each, sorted by rate descending. */
export function summariseTaxByRate(lines: TaxableLine[]): TaxSummaryRow[] {
  const map = new Map<string, TaxSummaryRow>();
  for (const line of lines) {
    const key = line.taxRateId ?? `bp:${line.taxRateBp}`;
    let row = map.get(key);
    if (!row) {
      row = {
        taxRateId: line.taxRateId,
        name: line.taxRateName ?? (line.taxRateBp === 0 ? 'No tax' : `${line.taxRateBp / 100}%`),
        rateBp: line.taxRateBp,
        netCents: 0,
        taxCents: 0,
      };
      map.set(key, row);
    }
    row.netCents += line.netCents;
    row.taxCents += taxForLine(line.netCents, line.taxRateBp);
  }
  return [...map.values()].sort((a, b) => b.rateBp - a.rateBp || a.name.localeCompare(b.name));
}

/** Gross → net when a price is entered tax-inclusive. */
export function netFromGross(grossCents: Cents, rateBp: BasisPoints): Cents {
  if (rateBp === 0) return grossCents;
  return Math.round((grossCents * 10_000) / (10_000 + rateBp));
}
