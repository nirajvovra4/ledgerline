import { describe, expect, it } from 'vitest';
import { formatInvoiceNumber, parseInvoiceNumber, previewInvoiceNumbers } from './numbering';

describe('formatInvoiceNumber', () => {
  it('pads the number and joins with a hyphen', () => {
    expect(formatInvoiceNumber('INV', 42, 4)).toBe('INV-0042');
    expect(formatInvoiceNumber('INV', 1042, 4)).toBe('INV-1042');
    expect(formatInvoiceNumber('inv', 1, 2)).toBe('inv-01');
    expect(formatInvoiceNumber('INV', 7, 0)).toBe('INV-7');
  });

  it('does not truncate numbers wider than the padding', () => {
    expect(formatInvoiceNumber('INV', 123456, 4)).toBe('INV-123456');
  });

  it('omits the hyphen when there is no prefix', () => {
    expect(formatInvoiceNumber('', 7, 3)).toBe('007');
    expect(formatInvoiceNumber('   ', 7, 3)).toBe('007');
    expect(formatInvoiceNumber(' INV ', 7, 3)).toBe('INV-007');
  });

  it('clamps negative numbers and truncates fractions', () => {
    expect(formatInvoiceNumber('INV', -3, 4)).toBe('INV-0000');
    expect(formatInvoiceNumber('INV', 7.9, 4)).toBe('INV-0007');
    expect(formatInvoiceNumber('INV', 7, -2)).toBe('INV-7');
  });
});

describe('parseInvoiceNumber', () => {
  it('parses prefixed and bare numbers', () => {
    expect(parseInvoiceNumber('INV-0042')).toEqual({ prefix: 'INV', n: 42 });
    expect(parseInvoiceNumber('0042')).toEqual({ prefix: '', n: 42 });
    expect(parseInvoiceNumber(' INV-0042 ')).toEqual({ prefix: 'INV', n: 42 });
    expect(parseInvoiceNumber('A1-7')).toEqual({ prefix: 'A1', n: 7 });
    expect(parseInvoiceNumber('inv-1')).toEqual({ prefix: 'inv', n: 1 });
  });

  it('rejects malformed numbers', () => {
    expect(parseInvoiceNumber('')).toBeNull();
    expect(parseInvoiceNumber('INV-')).toBeNull();
    expect(parseInvoiceNumber('-42')).toBeNull();
    expect(parseInvoiceNumber('INV42')).toBeNull();
    expect(parseInvoiceNumber('1INV-7')).toBeNull();
    expect(parseInvoiceNumber('INV-abc')).toBeNull();
    expect(parseInvoiceNumber('INV-00 42')).toBeNull();
    expect(parseInvoiceNumber('IN-V-42')).toBeNull();
  });

  it('round-trips with formatInvoiceNumber', () => {
    const cases: Array<[string, number, number]> = [
      ['INV', 1, 4],
      ['INV', 1042, 4],
      ['', 9, 3],
      ['Q2', 77, 0],
      ['ACME2024', 123456789, 6],
    ];
    for (const [prefix, n, padding] of cases) {
      expect(parseInvoiceNumber(formatInvoiceNumber(prefix, n, padding))).toEqual({ prefix, n });
    }
  });
});

describe('previewInvoiceNumbers', () => {
  it('previews the next numbers in sequence', () => {
    expect(previewInvoiceNumbers('INV', 1042, 4)).toEqual(['INV-1042', 'INV-1043', 'INV-1044']);
    expect(previewInvoiceNumbers('', 1, 2, 5)).toEqual(['01', '02', '03', '04', '05']);
    expect(previewInvoiceNumbers('INV', 1, 4, 0)).toEqual([]);
  });
});
