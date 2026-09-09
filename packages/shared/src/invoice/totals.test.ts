import { describe, expect, it } from 'vitest';
import { balanceForInvoice, computeInvoiceTotals } from './totals';

describe('computeInvoiceTotals', () => {
  it('worked example: two lines, 10% discount, 20% and 0% tax', () => {
    // gross: 2 × 100.00 = 200.00 (20% tax), 1 × 50.00 = 50.00 (no tax)
    // subtotal 250.00, discount 25.00 allocated 20.00 / 5.00
    // net 180.00 + 45.00; tax 36.00 on the discounted 180.00; total 225.00 + 36.00 = 261.00
    const t = computeInvoiceTotals(
      [
        { quantity: 2, unitPriceCents: 10000, taxRateBp: 2000 },
        { quantity: 1, unitPriceCents: 5000, taxRateBp: 0 },
      ],
      1000,
    );
    expect(t.lines).toEqual([
      { grossCents: 20000, discountCents: 2000, lineTotalCents: 18000, taxCents: 3600 },
      { grossCents: 5000, discountCents: 500, lineTotalCents: 4500, taxCents: 0 },
    ]);
    expect(t.subtotalCents).toBe(25000);
    expect(t.discountCents).toBe(2500);
    expect(t.taxCents).toBe(3600);
    expect(t.totalCents).toBe(26100);
  });

  it('worked example: no discount, mixed rates with half-even rounding', () => {
    // 3 × 19.99 = 59.97, tax 20% = 11.994 -> 11.99
    // 1.5 × 45.00 = 67.50, tax 5% = 3.375 -> 3.38 (half-even on 337.5)
    const t = computeInvoiceTotals([
      { quantity: 3, unitPriceCents: 1999, taxRateBp: 2000 },
      { quantity: 1.5, unitPriceCents: 4500, taxRateBp: 500 },
    ]);
    expect(t.lines.map((l) => l.grossCents)).toEqual([5997, 6750]);
    expect(t.lines.map((l) => l.discountCents)).toEqual([0, 0]);
    expect(t.lines.map((l) => l.taxCents)).toEqual([1199, 338]);
    expect(t.subtotalCents).toBe(12747);
    expect(t.discountCents).toBe(0);
    expect(t.taxCents).toBe(1537);
    expect(t.totalCents).toBe(14284);
  });

  it('charges tax on the discounted net', () => {
    const t = computeInvoiceTotals([{ quantity: 1, unitPriceCents: 10000, taxRateBp: 2000 }], 5000);
    expect(t.discountCents).toBe(5000);
    expect(t.lines[0]).toEqual({
      grossCents: 10000,
      discountCents: 5000,
      lineTotalCents: 5000,
      taxCents: 1000,
    });
    expect(t.totalCents).toBe(6000);
  });

  it('allocates the discount so line discounts sum exactly to the invoice discount', () => {
    const t = computeInvoiceTotals(
      [
        { quantity: 1, unitPriceCents: 3333, taxRateBp: 0 },
        { quantity: 1, unitPriceCents: 3333, taxRateBp: 0 },
        { quantity: 1, unitPriceCents: 3334, taxRateBp: 0 },
      ],
      1000,
    );
    expect(t.discountCents).toBe(1000);
    expect(t.lines.map((l) => l.discountCents)).toEqual([333, 333, 334]);
    expect(t.lines.map((l) => l.lineTotalCents)).toEqual([3000, 3000, 3000]);
    expect(t.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(t.discountCents);
    expect(t.lines.reduce((s, l) => s + l.lineTotalCents, 0)).toBe(
      t.subtotalCents - t.discountCents,
    );
  });

  it('keeps discount allocation exact for awkward amounts', () => {
    const t = computeInvoiceTotals(
      [
        { quantity: 1, unitPriceCents: 1, taxRateBp: 0 },
        { quantity: 1, unitPriceCents: 1, taxRateBp: 0 },
        { quantity: 1, unitPriceCents: 1, taxRateBp: 0 },
      ],
      5000,
    );
    expect(t.subtotalCents).toBe(3);
    expect(t.discountCents).toBe(2); // 1.5 rounds half-even to 2
    expect(t.lines.map((l) => l.discountCents)).toEqual([1, 1, 0]);
    expect(t.totalCents).toBe(1);

    const lines = [7, 11, 13, 17, 19, 23, 29].map((p) => ({
      quantity: 1,
      unitPriceCents: p * 101,
      taxRateBp: 2000,
    }));
    for (const bp of [1, 333, 1000, 1250, 3333, 9999]) {
      const r = computeInvoiceTotals(lines, bp);
      expect(r.lines.reduce((s, l) => s + l.discountCents, 0)).toBe(r.discountCents);
      expect(r.lines.reduce((s, l) => s + l.taxCents, 0)).toBe(r.taxCents);
      expect(r.totalCents).toBe(r.subtotalCents - r.discountCents + r.taxCents);
    }
  });

  it('multiplies fractional quantities with half-even rounding', () => {
    const t = computeInvoiceTotals([
      { quantity: 0.5, unitPriceCents: 999, taxRateBp: 0 }, // 499.5 -> 500
      { quantity: 0.25, unitPriceCents: 1000, taxRateBp: 0 },
      { quantity: 1.3333, unitPriceCents: 3, taxRateBp: 0 }, // 3.9999 -> 4
      { quantity: 0.5, unitPriceCents: 333, taxRateBp: 0 }, // 166.5 -> 166
    ]);
    expect(t.lines.map((l) => l.grossCents)).toEqual([500, 250, 4, 166]);
    expect(t.subtotalCents).toBe(920);
    expect(t.totalCents).toBe(920);
  });

  it('treats a missing or non-positive discount as none', () => {
    const lines = [{ quantity: 1, unitPriceCents: 1000, taxRateBp: 0 }];
    expect(computeInvoiceTotals(lines).discountCents).toBe(0);
    expect(computeInvoiceTotals(lines, 0).discountCents).toBe(0);
    expect(computeInvoiceTotals(lines, -500).discountCents).toBe(0);
    expect(computeInvoiceTotals(lines, 0).lines[0]?.discountCents).toBe(0);
  });

  it('handles credit (negative) lines without allocating discount to them', () => {
    const t = computeInvoiceTotals(
      [
        { quantity: 1, unitPriceCents: -5000, taxRateBp: 2000 },
        { quantity: 1, unitPriceCents: 10000, taxRateBp: 2000 },
      ],
      1000,
    );
    expect(t.subtotalCents).toBe(5000);
    expect(t.discountCents).toBe(500);
    expect(t.lines.map((l) => l.discountCents)).toEqual([0, 500]);
    expect(t.lines.map((l) => l.lineTotalCents)).toEqual([-5000, 9500]);
    expect(t.lines.map((l) => l.taxCents)).toEqual([-1000, 1900]);
    expect(t.taxCents).toBe(900);
    expect(t.totalCents).toBe(5400);
  });

  it('returns zeros for an empty invoice', () => {
    expect(computeInvoiceTotals([], 1000)).toEqual({
      lines: [],
      subtotalCents: 0,
      discountCents: 0,
      taxCents: 0,
      totalCents: 0,
    });
  });

  it('is deterministic', () => {
    const lines = [
      { quantity: 2.5, unitPriceCents: 1234, taxRateBp: 2000 },
      { quantity: 1, unitPriceCents: 999, taxRateBp: 500 },
    ];
    expect(computeInvoiceTotals(lines, 750)).toEqual(computeInvoiceTotals(lines, 750));
  });
});

describe('balanceForInvoice', () => {
  it('is the unpaid remainder, never negative', () => {
    expect(balanceForInvoice(1000, 0)).toBe(1000);
    expect(balanceForInvoice(1000, 400)).toBe(600);
    expect(balanceForInvoice(1000, 1000)).toBe(0);
    expect(balanceForInvoice(1000, 1500)).toBe(0);
    expect(balanceForInvoice(0, 0)).toBe(0);
  });
});
