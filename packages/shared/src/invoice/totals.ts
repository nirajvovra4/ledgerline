import { allocateProportionally, applyBp, mulCents } from '../money';
import { taxForLine } from '../tax';
import type { BasisPoints, Cents } from '../types';

export interface LineInput {
  quantity: number;
  unitPriceCents: Cents;
  taxRateBp: BasisPoints;
}

export interface LineTotals {
  /** quantity × unit price, before discount. */
  grossCents: Cents;
  /** Share of the invoice-level discount allocated to this line. */
  discountCents: Cents;
  /** grossCents − discountCents. */
  lineTotalCents: Cents;
  /** Tax on the discounted net. */
  taxCents: Cents;
}

export interface InvoiceTotals {
  lines: LineTotals[];
  subtotalCents: Cents;
  discountCents: Cents;
  taxCents: Cents;
  totalCents: Cents;
}

/**
 * The single place where an invoice's numbers are computed. Both the editor (live preview) and
 * the API (persisted values) call this so a document can never disagree with itself.
 *
 * The discount is applied at invoice level and allocated to lines proportionally, so that tax is
 * charged on the discounted amount for each rate.
 */
export function computeInvoiceTotals(lines: LineInput[], discountBp: BasisPoints = 0): InvoiceTotals {
  const gross = lines.map((l) => mulCents(l.unitPriceCents, l.quantity));
  const subtotalCents = gross.reduce((a, b) => a + b, 0);
  const discountCents = discountBp > 0 ? applyBp(subtotalCents, discountBp) : 0;
  const discountShares = discountCents > 0 ? allocateProportionally(discountCents, gross.map((g) => Math.max(g, 0))) : gross.map(() => 0);

  const lineTotals: LineTotals[] = lines.map((line, i) => {
    const grossCents = gross[i] ?? 0;
    const lineDiscount = discountShares[i] ?? 0;
    const lineTotalCents = grossCents - lineDiscount;
    return {
      grossCents,
      discountCents: lineDiscount,
      lineTotalCents,
      taxCents: taxForLine(lineTotalCents, line.taxRateBp),
    };
  });

  const taxCents = lineTotals.reduce((a, l) => a + l.taxCents, 0);
  const netCents = subtotalCents - discountCents;
  return { lines: lineTotals, subtotalCents, discountCents, taxCents, totalCents: netCents + taxCents };
}

export function balanceForInvoice(totalCents: Cents, amountPaidCents: Cents): Cents {
  return Math.max(0, totalCents - amountPaidCents);
}
