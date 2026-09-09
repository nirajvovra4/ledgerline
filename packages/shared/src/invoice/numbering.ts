export function formatInvoiceNumber(prefix: string, n: number, padding: number): string {
  const digits = String(Math.max(0, Math.trunc(n))).padStart(Math.max(0, padding), '0');
  const p = prefix.trim();
  return p ? `${p}-${digits}` : digits;
}

export function parseInvoiceNumber(value: string): { prefix: string; n: number } | null {
  const m = /^(?:([A-Za-z][A-Za-z0-9]*)-)?(\d+)$/.exec(value.trim());
  if (!m) return null;
  return { prefix: m[1] ?? '', n: Number(m[2]) };
}

/** Preview of the next few numbers, used on the settings screen. */
export function previewInvoiceNumbers(prefix: string, next: number, padding: number, count = 3): string[] {
  return Array.from({ length: count }, (_, i) => formatInvoiceNumber(prefix, next + i, padding));
}
