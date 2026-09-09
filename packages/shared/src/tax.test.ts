import { describe, expect, it } from 'vitest';
import { netFromGross, summariseTaxByRate, taxForLine } from './tax';

describe('taxForLine', () => {
  it('applies the rate with half-even rounding', () => {
    expect(taxForLine(10000, 2000)).toBe(2000);
    expect(taxForLine(12345, 825)).toBe(1018); // 1018.4625
    expect(taxForLine(1, 2000)).toBe(0); // 0.2
    expect(taxForLine(3, 5000)).toBe(2); // 1.5 -> 2
    expect(taxForLine(1, 5000)).toBe(0); // 0.5 -> 0
    expect(taxForLine(999, 1000)).toBe(100); // 99.9
  });

  it('returns zero for a zero rate and negatives for credits', () => {
    expect(taxForLine(10000, 0)).toBe(0);
    expect(taxForLine(0, 2000)).toBe(0);
    expect(taxForLine(-10000, 2000)).toBe(-2000);
  });
});

describe('summariseTaxByRate', () => {
  it('groups by tax rate id, totals net and tax, sorted by rate descending', () => {
    const rows = summariseTaxByRate([
      { netCents: 10000, taxRateId: 'vat20', taxRateBp: 2000, taxRateName: 'VAT 20%' },
      { netCents: 4000, taxRateId: null, taxRateBp: 0 },
      { netCents: 5000, taxRateId: 'vat20', taxRateBp: 2000, taxRateName: 'VAT 20%' },
      { netCents: 2000, taxRateId: 'r5', taxRateBp: 500 },
    ]);
    expect(rows).toEqual([
      { taxRateId: 'vat20', name: 'VAT 20%', rateBp: 2000, netCents: 15000, taxCents: 3000 },
      { taxRateId: 'r5', name: '5%', rateBp: 500, netCents: 2000, taxCents: 100 },
      { taxRateId: null, name: 'No tax', rateBp: 0, netCents: 4000, taxCents: 0 },
    ]);
  });

  it('keeps distinct rate ids apart even with the same rate, ordering ties by name', () => {
    const rows = summariseTaxByRate([
      { netCents: 100, taxRateId: 'b', taxRateBp: 2000, taxRateName: 'Zed' },
      { netCents: 200, taxRateId: 'a', taxRateBp: 2000, taxRateName: 'Alpha' },
    ]);
    expect(rows.map((r) => r.name)).toEqual(['Alpha', 'Zed']);
    expect(rows.map((r) => r.netCents)).toEqual([200, 100]);
  });

  it('groups id-less lines by their rate', () => {
    const rows = summariseTaxByRate([
      { netCents: 100, taxRateId: null, taxRateBp: 1000 },
      { netCents: 300, taxRateId: null, taxRateBp: 1000 },
      { netCents: 50, taxRateId: null, taxRateBp: 0 },
    ]);
    expect(rows).toEqual([
      { taxRateId: null, name: '10%', rateBp: 1000, netCents: 400, taxCents: 40 },
      { taxRateId: null, name: 'No tax', rateBp: 0, netCents: 50, taxCents: 0 },
    ]);
    expect(summariseTaxByRate([{ netCents: 100, taxRateId: null, taxRateBp: 1250 }])[0]?.name).toBe('12.5%');
  });

  it('computes tax per line before summing', () => {
    const rows = summariseTaxByRate([
      { netCents: 3, taxRateId: 'half', taxRateBp: 5000 },
      { netCents: 3, taxRateId: 'half', taxRateBp: 5000 },
    ]);
    expect(rows[0]).toMatchObject({ netCents: 6, taxCents: 4 }); // 2 + 2, not round(3)
  });

  it('returns nothing for no lines', () => {
    expect(summariseTaxByRate([])).toEqual([]);
  });
});

describe('netFromGross', () => {
  it('backs the tax out of a gross amount', () => {
    expect(netFromGross(12000, 2000)).toBe(10000);
    expect(netFromGross(11900, 1900)).toBe(10000);
    expect(netFromGross(100, 2000)).toBe(83); // 83.33
    expect(netFromGross(1, 2000)).toBe(1); // 0.83
    expect(netFromGross(0, 2000)).toBe(0);
  });

  it('is the identity for a zero rate', () => {
    expect(netFromGross(10000, 0)).toBe(10000);
  });

  it('is consistent with taxForLine for exact cases', () => {
    const net = netFromGross(12000, 2000);
    expect(net + taxForLine(net, 2000)).toBe(12000);
  });
});
