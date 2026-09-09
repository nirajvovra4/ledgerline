import { describe, expect, it } from 'vitest';
import { csvFilename, escapeCsvCell, toCsv } from './csv';

describe('csv', () => {
  it('escapes commas, quotes and newlines', () => {
    expect(escapeCsvCell('plain')).toBe('plain');
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line\nbreak')).toBe('"line\nbreak"');
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(12.5)).toBe('12.5');
    expect(escapeCsvCell(true)).toBe('true');
  });
  it('serialises headers and rows with CRLF and a BOM', () => {
    const out = toCsv(
      ['Name', 'Amount'],
      [
        ['Acme, Inc', 1250.5],
        ['Bob', null],
      ],
    );
    expect(out.startsWith('﻿')).toBe(true);
    expect(out.replace('﻿', '')).toBe('Name,Amount\r\n"Acme, Inc",1250.5\r\nBob,\r\n');
  });
  it('can omit the BOM', () => {
    expect(toCsv(['a'], [], { bom: false })).toBe('a\r\n');
  });
  it('builds safe filenames', () => {
    expect(csvFilename('Acme Studios / invoices')).toBe('acme-studios-invoices.csv');
    expect(csvFilename('')).toBe('export.csv');
  });
});
