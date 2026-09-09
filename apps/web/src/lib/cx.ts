export type ClassValue =
  string | number | bigint | null | undefined | false | Record<string, boolean | null | undefined>;

/** Tiny classnames helper: cx('a', cond && 'b', { c: true }) → "a b c". */
export function cx(...values: ClassValue[]): string {
  const out: string[] = [];
  for (const v of values) {
    if (!v) continue;
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v));
    } else {
      for (const [key, on] of Object.entries(v)) if (on) out.push(key);
    }
  }
  return out.join(' ');
}
