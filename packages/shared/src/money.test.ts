import { describe, expect, it } from 'vitest';
import {
  addCents,
  allocateProportionally,
  applyBp,
  centsToDecimalString,
  clampCents,
  formatBp,
  formatMoney,
  formatMoneyCompact,
  mulCents,
  parseBpInput,
  parseMoneyInput,
  percentChangeBp,
  roundHalfEven,
  shareBp,
  sumCents,
} from './money';

describe('roundHalfEven', () => {
  it('rounds ties to the nearest even integer', () => {
    expect(roundHalfEven(0.5)).toBe(0);
    expect(roundHalfEven(1.5)).toBe(2);
    expect(roundHalfEven(2.5)).toBe(2);
    expect(roundHalfEven(3.5)).toBe(4);
    expect(roundHalfEven(4.5)).toBe(4);
  });

  it('rounds ties to even for negative values', () => {
    expect(roundHalfEven(-0.5)).toBe(0);
    expect(roundHalfEven(-1.5)).toBe(-2);
    expect(roundHalfEven(-2.5)).toBe(-2);
    expect(roundHalfEven(-3.5)).toBe(-4);
  });

  it('rounds non-ties normally', () => {
    expect(roundHalfEven(2.4999)).toBe(2);
    expect(roundHalfEven(2.5001)).toBe(3);
    expect(roundHalfEven(-2.6)).toBe(-3);
    expect(roundHalfEven(-2.4)).toBe(-2);
    expect(roundHalfEven(7)).toBe(7);
  });

  it('treats values within epsilon of .5 as ties', () => {
    expect(roundHalfEven(2.5 + 1e-12)).toBe(2);
    expect(roundHalfEven(3.5 - 1e-12)).toBe(4);
  });

  it('maps non-finite input to 0', () => {
    expect(roundHalfEven(Number.NaN)).toBe(0);
    expect(roundHalfEven(Number.POSITIVE_INFINITY)).toBe(0);
    expect(roundHalfEven(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('addCents / sumCents', () => {
  it('adds integer cents', () => {
    expect(addCents(1, 2, 3)).toBe(6);
    expect(addCents()).toBe(0);
    expect(addCents(-500, 200)).toBe(-300);
    expect(sumCents([1, 2, 3])).toBe(6);
    expect(sumCents(new Set([10, 20]))).toBe(30);
  });

  it('rejects fractional cents', () => {
    expect(() => addCents(1.5)).toThrow(TypeError);
    expect(() => sumCents([1, 0.1])).toThrow(/integer number of cents/);
  });
});

describe('mulCents', () => {
  it('multiplies by whole and fractional quantities', () => {
    expect(mulCents(1000, 3)).toBe(3000);
    expect(mulCents(1000, 1.5)).toBe(1500);
    expect(mulCents(999, 0.5)).toBe(500); // 499.5 -> 500 (even)
    expect(mulCents(333, 0.5)).toBe(166); // 166.5 -> 166 (even)
    expect(mulCents(335, 0.5)).toBe(168); // 167.5 -> 168 (even)
    expect(mulCents(1999, 0.333)).toBe(666); // 665.667
    expect(mulCents(1000, 0.25)).toBe(250);
    expect(mulCents(3, 1.3333)).toBe(4); // 3.9999
  });

  it('limits quantities to four decimal places', () => {
    expect(mulCents(100, 0.33333)).toBe(33); // 0.3333 * 100 = 33.33
    expect(mulCents(10000, 1.0001)).toBe(10001);
    expect(mulCents(10000, 1.00004)).toBe(10000); // fifth decimal is dropped
  });

  it('handles zero and negatives', () => {
    expect(mulCents(1000, 0)).toBe(0);
    expect(mulCents(-1000, 2)).toBe(-2000);
    expect(mulCents(1000, -1.5)).toBe(-1500);
  });

  it('validates its inputs', () => {
    expect(() => mulCents(10.5, 1)).toThrow(TypeError);
    expect(() => mulCents(1000, Number.NaN)).toThrow(/finite/);
    expect(() => mulCents(1000, Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});

describe('applyBp', () => {
  it('applies basis points with half-even rounding', () => {
    expect(applyBp(10000, 2000)).toBe(2000);
    expect(applyBp(1250, 2000)).toBe(250);
    expect(applyBp(100, 0)).toBe(0);
    expect(applyBp(1, 5000)).toBe(0); // 0.5 -> 0
    expect(applyBp(3, 5000)).toBe(2); // 1.5 -> 2
    expect(applyBp(12345, 825)).toBe(1018); // 1018.4625
    expect(applyBp(10000, 10000)).toBe(10000);
  });

  it('works on negative amounts', () => {
    expect(applyBp(-1000, 2000)).toBe(-200);
    expect(applyBp(-3, 5000)).toBe(-2);
  });

  it('rejects fractional cents or basis points', () => {
    expect(() => applyBp(10.5, 100)).toThrow(TypeError);
    expect(() => applyBp(1000, 12.5)).toThrow(/basis points/);
  });
});

describe('shareBp', () => {
  it('expresses a part as a share of a whole', () => {
    expect(shareBp(50, 200)).toBe(2500);
    expect(shareBp(200, 200)).toBe(10000);
    expect(shareBp(1, 3)).toBe(3333);
    expect(shareBp(2, 3)).toBe(6667);
    expect(shareBp(0, 500)).toBe(0);
    expect(shareBp(-50, 200)).toBe(-2500);
  });

  it('returns 0 for a zero whole', () => {
    expect(shareBp(100, 0)).toBe(0);
    expect(shareBp(0, 0)).toBe(0);
  });
});

describe('allocateProportionally', () => {
  it('splits exactly when the weights divide the total', () => {
    expect(allocateProportionally(1000, [3, 3, 4])).toEqual([300, 300, 400]);
    expect(allocateProportionally(100, [1])).toEqual([100]);
    expect(allocateProportionally(0, [1, 2, 3])).toEqual([0, 0, 0]);
  });

  it('gives the leftover cents to the largest fractional parts first (Hamilton)', () => {
    expect(allocateProportionally(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateProportionally(101, [1, 2])).toEqual([34, 67]);
    expect(allocateProportionally(7, [1, 1, 1, 1])).toEqual([2, 2, 2, 1]);
    expect(allocateProportionally(1000, [3333, 3333, 3334])).toEqual([333, 333, 334]);
    expect(allocateProportionally(2, [1, 1, 1])).toEqual([1, 1, 0]);
  });

  it('always sums exactly to the total', () => {
    const cases: Array<[number, number[]]> = [
      [100, [1, 1, 1]],
      [12345, [7, 11, 13, 17]],
      [99, [1, 2, 3, 4, 5, 6, 7, 8, 9]],
      [1, [5, 5]],
      [2500, [20000, 5000]],
      [-100, [1, 1, 1]],
      [-12345, [7, 11, 13]],
      [3, [1, 0, 1]],
      [10, [0, 0]],
    ];
    for (const [total, weights] of cases) {
      const parts = allocateProportionally(total, weights);
      expect(parts).toHaveLength(weights.length);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
      for (const p of parts) expect(Number.isInteger(p)).toBe(true);
    }
  });

  it('never moves a part more than one cent away from its exact share', () => {
    const total = 1234567;
    const weights = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89];
    const sum = weights.reduce((a, b) => a + b, 0);
    const parts = allocateProportionally(total, weights);
    parts.forEach((p, i) => {
      const exact = (total * (weights[i] ?? 0)) / sum;
      expect(Math.abs(p - exact)).toBeLessThan(1);
    });
  });

  it('is stable: identical input gives identical output and does not mutate weights', () => {
    const weights = [1, 1, 1, 1, 1, 1, 1];
    const a = allocateProportionally(5, weights);
    const b = allocateProportionally(5, weights);
    expect(a).toEqual(b);
    expect(a).toEqual([1, 1, 1, 1, 1, 0, 0]);
    expect(weights).toEqual([1, 1, 1, 1, 1, 1, 1]);
  });

  it('gives zero-weight entries nothing when other weights exist', () => {
    expect(allocateProportionally(100, [0, 1])).toEqual([0, 100]);
    expect(allocateProportionally(100, [0, 1, 1])).toEqual([0, 50, 50]);
  });

  it('splits evenly when every weight is zero', () => {
    expect(allocateProportionally(10, [0, 0, 0])).toEqual([4, 3, 3]);
    expect(allocateProportionally(9, [0, 0, 0])).toEqual([3, 3, 3]);
    expect(allocateProportionally(-10, [0, 0, 0])).toEqual([-4, -3, -3]);
  });

  it('allocates negative totals with the same rule', () => {
    expect(allocateProportionally(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
    expect(allocateProportionally(-101, [1, 2])).toEqual([-34, -67]);
  });

  it('returns an empty allocation for no weights', () => {
    expect(allocateProportionally(100, [])).toEqual([]);
  });

  it('rejects a fractional total', () => {
    expect(() => allocateProportionally(10.5, [1, 1])).toThrow(/total must be an integer/);
  });
});

describe('centsToDecimalString', () => {
  it('renders cents as a plain decimal', () => {
    expect(centsToDecimalString(123456)).toBe('1234.56');
    expect(centsToDecimalString(5)).toBe('0.05');
    expect(centsToDecimalString(0)).toBe('0.00');
    expect(centsToDecimalString(-5)).toBe('-0.05');
    expect(centsToDecimalString(-123456)).toBe('-1234.56');
  });

  it('honours the decimals argument', () => {
    expect(centsToDecimalString(1234, 0)).toBe('1234');
    expect(centsToDecimalString(-1234, 0)).toBe('-1234');
    expect(centsToDecimalString(1234, 3)).toBe('1.234');
  });

  it('rejects fractional cents', () => {
    expect(() => centsToDecimalString(1.5)).toThrow(TypeError);
  });
});

describe('formatMoney', () => {
  it('formats with symbol and thousands grouping by default', () => {
    expect(formatMoney(123456, 'USD')).toBe('$1,234.56');
    expect(formatMoney(0, 'USD')).toBe('$0.00');
    expect(formatMoney(5, 'USD')).toBe('$0.05');
    expect(formatMoney(100000, 'USD')).toBe('$1,000.00');
    expect(formatMoney(123456789012, 'USD')).toBe('$1,234,567,890.12');
    expect(formatMoney(99999, 'EUR')).toBe('€999.99');
    expect(formatMoney(100, 'GBP')).toBe('£1.00');
  });

  it('renders negatives with a leading minus, or parentheses in accounting mode', () => {
    expect(formatMoney(-123456, 'USD')).toBe('-$1,234.56');
    expect(formatMoney(-123456, 'USD', { accounting: true })).toBe('($1,234.56)');
    expect(formatMoney(123456, 'USD', { accounting: true })).toBe('$1,234.56');
    expect(formatMoney(-5, 'USD', { accounting: true })).toBe('($0.05)');
  });

  it('can omit the symbol', () => {
    expect(formatMoney(123456, 'USD', { symbol: false })).toBe('1,234.56');
    expect(formatMoney(-123456, 'USD', { symbol: false })).toBe('-1,234.56');
    expect(formatMoney(-123456, 'USD', { symbol: false, accounting: true })).toBe('(1,234.56)');
    expect(formatMoney(100000, 'CHF', { symbol: false })).toBe('1,000.00');
  });

  it('drops zero cents only when asked', () => {
    expect(formatMoney(100000, 'USD', { compactZeroCents: true })).toBe('$1,000');
    expect(formatMoney(100050, 'USD', { compactZeroCents: true })).toBe('$1,000.50');
    expect(formatMoney(0, 'USD', { compactZeroCents: true })).toBe('$0');
    expect(formatMoney(-100000, 'USD', { compactZeroCents: true })).toBe('-$1,000');
  });

  it('renders an explicit plus sign only for positive amounts', () => {
    expect(formatMoney(500, 'USD', { explicitSign: true })).toBe('+$5.00');
    expect(formatMoney(0, 'USD', { explicitSign: true })).toBe('$0.00');
    expect(formatMoney(-500, 'USD', { explicitSign: true })).toBe('-$5.00');
    expect(formatMoney(500, 'USD', { explicitSign: true, symbol: false })).toBe('+5.00');
  });

  it('respects zero-decimal currencies', () => {
    expect(formatMoney(123456, 'JPY')).toBe('¥123,456');
    expect(formatMoney(-123456, 'JPY')).toBe('-¥123,456');
    expect(formatMoney(0, 'JPY')).toBe('¥0');
    expect(formatMoney(123456, 'JPY', { compactZeroCents: true })).toBe('¥123,456');
    expect(formatMoney(-123456, 'JPY', { accounting: true })).toBe('(¥123,456)');
  });

  it('puts a space after multi-letter symbols', () => {
    expect(formatMoney(100000, 'CHF')).toBe('CHF 1,000.00');
    expect(formatMoney(-100000, 'CHF')).toBe('-CHF 1,000.00');
    expect(formatMoney(-100000, 'CHF', { accounting: true })).toBe('(CHF 1,000.00)');
    expect(formatMoney(100000, 'SEK')).toBe('kr 1,000.00');
    expect(formatMoney(100000, 'CAD')).toBe('CA$ 1,000.00');
    expect(formatMoney(100000, 'ZAR')).toBe('R1,000.00'); // single letter: no space
    expect(formatMoney(100000, 'XYZ')).toBe('XYZ 1,000.00'); // unknown currency falls back to its code
  });

  it('rejects fractional cents', () => {
    expect(() => formatMoney(1.5, 'USD')).toThrow(TypeError);
  });
});

describe('formatMoneyCompact', () => {
  it('uses M above a million units', () => {
    expect(formatMoneyCompact(123456700, 'USD')).toBe('$1.2M');
    expect(formatMoneyCompact(100000000, 'USD')).toBe('$1M');
    expect(formatMoneyCompact(250000000, 'USD')).toBe('$2.5M');
  });

  it('uses one-decimal k from 10,000 units', () => {
    expect(formatMoneyCompact(1240000, 'USD')).toBe('$12.4k');
    expect(formatMoneyCompact(1000000, 'USD')).toBe('$10k');
    expect(formatMoneyCompact(99999999, 'USD')).toBe('$1000k');
  });

  it('uses two-decimal k from 1,000 units', () => {
    expect(formatMoneyCompact(123456, 'USD')).toBe('$1.23k');
    expect(formatMoneyCompact(150000, 'USD')).toBe('$1.5k');
    expect(formatMoneyCompact(100000, 'USD')).toBe('$1k');
    expect(formatMoneyCompact(250000, 'USD')).toBe('$2.5k');
  });

  it('falls back to full formatting under 1,000 units', () => {
    expect(formatMoneyCompact(99999, 'USD')).toBe('$999.99');
    expect(formatMoneyCompact(50000, 'USD')).toBe('$500');
    expect(formatMoneyCompact(0, 'USD')).toBe('$0');
    expect(formatMoneyCompact(-50, 'USD')).toBe('-$0.50');
  });

  it('keeps the sign and respects currency decimals', () => {
    expect(formatMoneyCompact(-1240000, 'USD')).toBe('-$12.4k');
    expect(formatMoneyCompact(-123456700, 'USD')).toBe('-$1.2M');
    expect(formatMoneyCompact(1234567, 'JPY')).toBe('¥1.2M');
    expect(formatMoneyCompact(12400, 'JPY')).toBe('¥12.4k');
    expect(formatMoneyCompact(1500, 'CHF')).toBe('CHF 15');
  });
});

describe('parseMoneyInput', () => {
  it('parses plain and formatted decimals', () => {
    expect(parseMoneyInput('1,250.50')).toBe(125050);
    expect(parseMoneyInput('1250.50')).toBe(125050);
    expect(parseMoneyInput('12')).toBe(1200);
    expect(parseMoneyInput('0')).toBe(0);
    expect(parseMoneyInput('0.00')).toBe(0);
    expect(parseMoneyInput('1,000')).toBe(100000);
    expect(parseMoneyInput('1.000')).toBe(100000);
    expect(parseMoneyInput('1,000,000.99')).toBe(100000099);
  });

  it('ignores currency symbols, spaces and other noise', () => {
    expect(parseMoneyInput('$99')).toBe(9900);
    expect(parseMoneyInput('€ 99,90')).toBe(9990);
    expect(parseMoneyInput('1 200')).toBe(120000);
    expect(parseMoneyInput('  42.10  ')).toBe(4210);
    expect(parseMoneyInput('USD 5.00')).toBe(500);
    expect(parseMoneyInput('CHF 1 234,50')).toBe(123450);
  });

  it('understands negatives, explicit plus and accounting parentheses', () => {
    expect(parseMoneyInput('-12')).toBe(-1200);
    expect(parseMoneyInput('-$1,234.56')).toBe(-123456);
    expect(parseMoneyInput('(12.00)')).toBe(-1200);
    expect(parseMoneyInput('($1,000)')).toBe(-100000);
    expect(parseMoneyInput('+12.50')).toBe(1250);
  });

  it('accepts a comma as the decimal separator', () => {
    expect(parseMoneyInput('12,5')).toBe(1250);
    expect(parseMoneyInput('12,50')).toBe(1250);
    expect(parseMoneyInput('1.234,56')).toBe(123456);
    expect(parseMoneyInput('1,234.56')).toBe(123456);
  });

  it('handles leading or trailing separators', () => {
    expect(parseMoneyInput('.5')).toBe(50);
    expect(parseMoneyInput(',5')).toBe(50);
    expect(parseMoneyInput('5.')).toBe(500);
    expect(parseMoneyInput('.')).toBeNull();
  });

  it('pads or truncates the fraction to the currency decimals', () => {
    expect(parseMoneyInput('1.5')).toBe(150);
    expect(parseMoneyInput('1.5', 0)).toBe(1);
    expect(parseMoneyInput('1234', 0)).toBe(1234);
    expect(parseMoneyInput('1.234', 3)).toBe(1234);
    expect(parseMoneyInput('1.2', 3)).toBe(1200);
  });

  it('returns null for empty or non-numeric input', () => {
    expect(parseMoneyInput('')).toBeNull();
    expect(parseMoneyInput('   ')).toBeNull();
    expect(parseMoneyInput('abc')).toBeNull();
    expect(parseMoneyInput('$')).toBeNull();
    expect(parseMoneyInput('-')).toBeNull();
    expect(parseMoneyInput('--5')).toBeNull();
    expect(parseMoneyInput('()')).toBeNull();
    expect(parseMoneyInput(undefined as unknown as string)).toBeNull();
    expect(parseMoneyInput(12 as unknown as string)).toBeNull();
  });

  it('returns null when the value cannot be represented safely', () => {
    expect(parseMoneyInput('99999999999999999')).toBeNull();
    expect(parseMoneyInput('9007199254740993')).toBeNull();
    expect(parseMoneyInput('90071992547409.91')).toBe(9007199254740991);
  });

  it('round-trips through centsToDecimalString', () => {
    for (const cents of [0, 1, 99, 100, 123456, 100000000, -1, -123456]) {
      expect(parseMoneyInput(centsToDecimalString(cents))).toBe(cents);
    }
  });
});

describe('formatBp / parseBpInput', () => {
  it('formats basis points as a trimmed percentage', () => {
    expect(formatBp(2000)).toBe('20%');
    expect(formatBp(1250)).toBe('12.5%');
    expect(formatBp(1)).toBe('0.01%');
    expect(formatBp(0)).toBe('0%');
    expect(formatBp(10000)).toBe('100%');
    expect(formatBp(-500)).toBe('-5%');
    expect(formatBp(3333, { decimals: 1 })).toBe('33.3%');
    expect(formatBp(2050, { decimals: 0 })).toBe('21%');
    expect(formatBp(2000, { decimals: 0 })).toBe('20%');
  });

  it('parses percentages with or without the sign', () => {
    expect(parseBpInput('20%')).toBe(2000);
    expect(parseBpInput('20')).toBe(2000);
    expect(parseBpInput(' 12.5 ')).toBe(1250);
    expect(parseBpInput('0')).toBe(0);
    expect(parseBpInput('-5')).toBe(-500);
    expect(parseBpInput('33.33%')).toBe(3333);
    expect(parseBpInput('100%')).toBe(10000);
  });

  it('rejects malformed input', () => {
    expect(parseBpInput('')).toBeNull();
    expect(parseBpInput('abc')).toBeNull();
    expect(parseBpInput('.5')).toBeNull();
    expect(parseBpInput('20.')).toBeNull();
    expect(parseBpInput('1e3')).toBeNull();
    expect(parseBpInput('20%%')).toBeNull();
  });

  it('round-trips format -> parse', () => {
    for (const bp of [0, 1, 50, 99, 100, 1250, 2000, 3333, 6667, 9999, 10000]) {
      expect(parseBpInput(formatBp(bp))).toBe(bp);
      expect(parseBpInput(formatBp(bp, { decimals: 2 }))).toBe(bp);
    }
  });
});

describe('percentChangeBp', () => {
  it('computes the change relative to the previous value', () => {
    expect(percentChangeBp(120, 100)).toBe(2000);
    expect(percentChangeBp(80, 100)).toBe(-2000);
    expect(percentChangeBp(100, 100)).toBe(0);
    expect(percentChangeBp(0, 100)).toBe(-10000);
    expect(percentChangeBp(300, 100)).toBe(20000);
    expect(percentChangeBp(1, 3)).toBe(-6667);
  });

  it('uses the absolute previous value as the base', () => {
    expect(percentChangeBp(50, -100)).toBe(15000);
    expect(percentChangeBp(-150, -100)).toBe(-5000);
  });

  it('cannot express a change from zero', () => {
    expect(percentChangeBp(100, 0)).toBeNull();
    expect(percentChangeBp(-100, 0)).toBeNull();
    expect(percentChangeBp(0, 0)).toBe(0);
  });
});

describe('clampCents', () => {
  it('clamps into the inclusive range', () => {
    expect(clampCents(5, 0, 3)).toBe(3);
    expect(clampCents(-1, 0, 3)).toBe(0);
    expect(clampCents(2, 0, 3)).toBe(2);
    expect(clampCents(0, 0, 0)).toBe(0);
  });
});
