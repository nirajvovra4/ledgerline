import { describe, expect, it } from 'vitest';
import {
  compareNatural,
  compareStrings,
  formatAddress,
  formatNumber,
  humanize,
  initials,
  isBlank,
  joinNonEmpty,
  matchesQuery,
  normaliseWhitespace,
  ordinal,
  pluralize,
  slugify,
  titleCase,
  truncate,
} from './text';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Northlight Studio')).toBe('northlight-studio');
    expect(slugify('  Hello   World  ')).toBe('hello-world');
    expect(slugify('already-a-slug')).toBe('already-a-slug');
  });

  it('strips accents', () => {
    expect(slugify('Crème Brûlée')).toBe('creme-brulee');
    expect(slugify('Zoë & Co.')).toBe('zoe-co');
    expect(slugify('Ñandú')).toBe('nandu');
  });

  it('collapses punctuation and trims hyphens', () => {
    expect(slugify('Acme, Inc.')).toBe('acme-inc');
    expect(slugify('--Foo__Bar--')).toBe('foo-bar');
    expect(slugify('!!!')).toBe('');
    expect(slugify('')).toBe('');
    expect(slugify('a/b\\c')).toBe('a-b-c');
  });

  it('caps the length at 48 characters', () => {
    expect(slugify('a'.repeat(60))).toHaveLength(48);
    expect(slugify('a'.repeat(48))).toBe('a'.repeat(48));
    expect(slugify('word '.repeat(20))).toHaveLength(48);
  });
});

describe('initials', () => {
  it('uses the first and last name', () => {
    expect(initials('Ada Lovelace')).toBe('AL');
    expect(initials('Ada Byron Lovelace')).toBe('AL');
    expect(initials('ada lovelace')).toBe('AL');
    expect(initials('  Ada   Lovelace  ')).toBe('AL');
    expect(initials('jean-luc picard')).toBe('JP');
  });

  it('handles single names and blanks', () => {
    expect(initials('Ada')).toBe('A');
    expect(initials('')).toBe('?');
    expect(initials('   ')).toBe('?');
  });
});

describe('pluralize', () => {
  it('picks singular for exactly one', () => {
    expect(pluralize(1, 'invoice')).toBe('1 invoice');
    expect(pluralize(2, 'invoice')).toBe('2 invoices');
    expect(pluralize(0, 'invoice')).toBe('0 invoices');
    expect(pluralize(-1, 'invoice')).toBe('-1 invoices');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(3, 'entry', 'entries')).toBe('3 entries');
    expect(pluralize(1, 'entry', 'entries')).toBe('1 entry');
  });
});

describe('truncate', () => {
  it('returns short strings untouched', () => {
    expect(truncate('hello', 10)).toBe('hello');
    expect(truncate('abc', 3)).toBe('abc');
  });

  it('cuts to the limit including the ellipsis', () => {
    expect(truncate('hello world', 8)).toBe('hello w…');
    expect(truncate('hello world', 8)).toHaveLength(8);
    expect(truncate('hello world', 6)).toBe('hello…');
    expect(truncate('hello world', 8, '...')).toBe('hello...');
  });

  it('trims trailing whitespace before the ellipsis', () => {
    expect(truncate('hello world', 7)).toBe('hello…');
  });

  it('never slices negatively', () => {
    expect(truncate('abcd', 0)).toBe('…');
  });
});

describe('titleCase / humanize', () => {
  it('title-cases words separated by spaces or underscores', () => {
    expect(titleCase('hello world')).toBe('Hello World');
    expect(titleCase('on_hold')).toBe('On Hold');
    expect(titleCase('pending_approval')).toBe('Pending Approval');
    expect(titleCase('HELLO')).toBe('Hello');
    expect(titleCase('  spaced   out ')).toBe('Spaced Out');
    expect(titleCase('')).toBe('');
  });

  it('humanizes identifiers into a sentence-cased phrase', () => {
    expect(humanize('pending_approval')).toBe('Pending approval');
    expect(humanize('bank-transfer')).toBe('Bank transfer');
    expect(humanize('camelCaseValue')).toBe('Camel case value');
    expect(humanize('expense_payment')).toBe('Expense payment');
    expect(humanize('')).toBe('');
  });
});

describe('compareStrings / compareNatural', () => {
  it('compares case-insensitively first, then by code point', () => {
    expect(compareStrings('apple', 'Banana')).toBe(-1);
    expect(compareStrings('Banana', 'apple')).toBe(1);
    expect(compareStrings('same', 'same')).toBe(0);
    expect(compareStrings('A', 'a')).toBe(-1);
    expect(compareStrings('a', 'A')).toBe(1);
  });

  it('sorts numeric runs by value', () => {
    expect(compareNatural('INV-0009', 'INV-0010')).toBeLessThan(0);
    expect(compareNatural('INV-0010', 'INV-0009')).toBeGreaterThan(0);
    expect(compareNatural('INV-0010', 'INV-0010')).toBe(0);
    expect(compareNatural('INV-2', 'INV-10')).toBeLessThan(0);
    expect(compareNatural('file10', 'file9')).toBeGreaterThan(0);
    expect(compareNatural('INV-0009', 'INV-9')).toBe(0);
  });

  it('treats a prefix as smaller and compares text runs by string', () => {
    expect(compareNatural('a', 'a1')).toBeLessThan(0);
    expect(compareNatural('a1', 'a')).toBeGreaterThan(0);
    expect(compareNatural('abc', 'abd')).toBeLessThan(0);
    expect(compareNatural('ACME-1', 'acme-2')).toBeLessThan(0);
  });

  it('orders an array of invoice numbers naturally', () => {
    const sorted = ['INV-0010', 'INV-0002', 'INV-0001', 'INV-0100', 'INV-0011'].sort(compareNatural);
    expect(sorted).toEqual(['INV-0001', 'INV-0002', 'INV-0010', 'INV-0011', 'INV-0100']);
  });
});

describe('whitespace helpers', () => {
  it('normalises whitespace', () => {
    expect(normaliseWhitespace('  a   b \n c ')).toBe('a b c');
    expect(normaliseWhitespace('')).toBe('');
  });

  it('detects blank values', () => {
    expect(isBlank(null)).toBe(true);
    expect(isBlank(undefined)).toBe(true);
    expect(isBlank('')).toBe(true);
    expect(isBlank('   ')).toBe(true);
    expect(isBlank('a')).toBe(false);
  });

  it('joins non-empty trimmed parts', () => {
    expect(joinNonEmpty(['a', '', null, undefined, ' b '])).toBe('a, b');
    expect(joinNonEmpty(['a', 'b'], ' / ')).toBe('a / b');
    expect(joinNonEmpty([null, '  '])).toBe('');
  });
});

describe('matchesQuery', () => {
  it('matches case-insensitively across fields', () => {
    expect(matchesQuery('acme', 'Acme Corp')).toBe(true);
    expect(matchesQuery('ACME', 'Acme Corp')).toBe(true);
    expect(matchesQuery('corp', 'Acme', 'Acme Corp')).toBe(true);
    expect(matchesQuery('  cme ', 'Acme')).toBe(true);
  });

  it('is true for an empty query and false with no matching field', () => {
    expect(matchesQuery('', 'anything')).toBe(true);
    expect(matchesQuery('   ')).toBe(true);
    expect(matchesQuery('zzz', 'Acme', null, undefined)).toBe(false);
    expect(matchesQuery('a')).toBe(false);
  });
});

describe('ordinal', () => {
  it('adds the right suffix', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(101)).toBe('101st');
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(113)).toBe('113th');
    expect(ordinal(0)).toBe('0th');
    expect(ordinal(100)).toBe('100th');
  });
});

describe('formatNumber', () => {
  it('groups thousands and fixes decimals', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(999)).toBe('999');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(1234.5, 1)).toBe('1,234.5');
    expect(formatNumber(1000.456, 2)).toBe('1,000.46');
    expect(formatNumber(12, 2)).toBe('12.00');
  });

  it('keeps the minus sign in front', () => {
    expect(formatNumber(-1234)).toBe('-1,234');
    expect(formatNumber(-1234567.891, 2)).toBe('-1,234,567.89');
  });
});

describe('formatAddress', () => {
  it('lays out a full address', () => {
    expect(
      formatAddress({
        addressLine1: '1 Main St',
        addressLine2: 'Suite 2',
        city: 'Springfield',
        region: 'IL',
        postalCode: '62701',
        country: 'USA',
      }),
    ).toEqual(['1 Main St', 'Suite 2', 'Springfield, IL 62701', 'USA']);
  });

  it('skips blank parts', () => {
    expect(formatAddress({})).toEqual([]);
    expect(formatAddress({ city: 'Springfield' })).toEqual(['Springfield']);
    expect(formatAddress({ postalCode: '62701' })).toEqual(['62701']);
    expect(formatAddress({ city: 'Springfield', postalCode: '62701' })).toEqual(['Springfield 62701']);
    expect(formatAddress({ region: 'IL', postalCode: '62701' })).toEqual(['IL 62701']);
    expect(formatAddress({ addressLine1: '  ', addressLine2: ' Flat 1 ', country: ' UK ' })).toEqual(['Flat 1', 'UK']);
  });
});
