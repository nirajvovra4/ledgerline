export type CsvCell = string | number | boolean | null | undefined;

/** Quote a single CSV cell: wraps in quotes when it contains a comma, quote or newline. */
export function escapeCsvCell(value: CsvCell): string {
  if (value == null) return '';
  const s = typeof value === 'string' ? value : String(value);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Serialise rows to CSV text (CRLF line endings, UTF-8 BOM for spreadsheet apps). */
export function toCsv(
  headers: string[],
  rows: CsvCell[][],
  options: { bom?: boolean } = {},
): string {
  const lines = [headers.map(escapeCsvCell).join(',')];
  for (const row of rows) lines.push(row.map(escapeCsvCell).join(','));
  return `${options.bom === false ? '' : '﻿'}${lines.join('\r\n')}\r\n`;
}

export function csvFilename(base: string): string {
  const safe = base
    .replace(/[^a-z0-9-_]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return `${safe || 'export'}.csv`;
}
