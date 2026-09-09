export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

export function initials(name: string, max = 2): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '');
  if (parts.length === 0) return '?';
  if (parts.length === 1) return (parts[0] ?? '').slice(0, max);
  return (parts[0] ?? '') + (parts[parts.length - 1] ?? '');
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(input: string, max: number, ellipsis = '…'): string {
  if (input.length <= max) return input;
  return input.slice(0, Math.max(0, max - ellipsis.length)).trimEnd() + ellipsis;
}

export function titleCase(input: string): string {
  return input
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function humanize(input: string): string {
  const spaced = input.replace(/[_-]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
}

export function compareStrings(a: string, b: string): number {
  const al = a.toLowerCase();
  const bl = b.toLowerCase();
  return al < bl ? -1 : al > bl ? 1 : a < b ? -1 : a > b ? 1 : 0;
}

/** Natural comparison so that "INV-0009" sorts before "INV-0010". */
export function compareNatural(a: string, b: string): number {
  const ax = a.match(/(\d+|\D+)/g) ?? [];
  const bx = b.match(/(\d+|\D+)/g) ?? [];
  const len = Math.max(ax.length, bx.length);
  for (let i = 0; i < len; i++) {
    const as = ax[i];
    const bs = bx[i];
    if (as === undefined) return -1;
    if (bs === undefined) return 1;
    const an = Number(as);
    const bn = Number(bs);
    if (!Number.isNaN(an) && !Number.isNaN(bn)) {
      if (an !== bn) return an - bn;
    } else {
      const c = compareStrings(as, bs);
      if (c !== 0) return c;
    }
  }
  return 0;
}

export function normaliseWhitespace(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

export function isBlank(value: string | null | undefined): boolean {
  return value == null || value.trim().length === 0;
}

export function joinNonEmpty(parts: Array<string | null | undefined>, separator = ', '): string {
  return parts
    .filter((p): p is string => !isBlank(p))
    .map((p) => p.trim())
    .join(separator);
}

/** Case-insensitive substring match across several fields, used by client-side filters. */
export function matchesQuery(query: string, ...fields: Array<string | null | undefined>): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

/** Simple ordinal suffix: 1st, 2nd, 3rd, 4th … */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole = '0', frac] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}${grouped}${frac ? `.${frac}` : ''}`;
}

export function formatAddress(parts: {
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  country?: string;
}): string[] {
  const lines: string[] = [];
  if (!isBlank(parts.addressLine1)) lines.push(parts.addressLine1!.trim());
  if (!isBlank(parts.addressLine2)) lines.push(parts.addressLine2!.trim());
  const cityLine = joinNonEmpty([parts.city, parts.region], ', ');
  const withPostal = joinNonEmpty([cityLine, parts.postalCode], ' ');
  if (withPostal) lines.push(withPostal);
  if (!isBlank(parts.country)) lines.push(parts.country!.trim());
  return lines;
}
