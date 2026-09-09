import { BP_DENOMINATOR, currencyInfo } from './constants';
import type { BasisPoints, Cents } from './types';

/**
 * Money helpers. Everything works on integer cents so that totals are exact and
 * reproducible on both server and client.
 */

export function assertCents(value: number, label = 'amount'): asserts value is Cents {
  if (!Number.isInteger(value)) {
    throw new TypeError(`${label} must be an integer number of cents, received ${value}`);
  }
}

/** Banker's rounding (round half to even) used everywhere fractional cents appear. */
export function roundHalfEven(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const floor = Math.floor(value);
  const diff = value - floor;
  const epsilon = 1e-9;
  if (Math.abs(diff - 0.5) < epsilon) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

export function addCents(...values: Cents[]): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  return total;
}

export function sumCents(values: Iterable<Cents>): Cents {
  let total = 0;
  for (const v of values) {
    assertCents(v);
    total += v;
  }
  return total;
}

/** Multiply a unit price by a (possibly fractional) quantity, rounding half-even. */
export function mulCents(cents: Cents, quantity: number): Cents {
  assertCents(cents, 'unit price');
  if (!Number.isFinite(quantity)) throw new TypeError('quantity must be finite');
  // Quantities are limited to 4 decimal places to keep arithmetic in the safe-integer range.
  const q = Math.round(quantity * 10_000);
  return roundHalfEven((cents * q) / 10_000);
}

/** Apply a basis-point rate (e.g. tax or discount) to an amount. */
export function applyBp(cents: Cents, bp: BasisPoints): Cents {
  assertCents(cents);
  if (!Number.isInteger(bp)) throw new TypeError('basis points must be an integer');
  return roundHalfEven((cents * bp) / BP_DENOMINATOR);
}

/** Express `part` as a share of `whole` in basis points (0 when `whole` is 0). */
export function shareBp(part: Cents, whole: Cents): BasisPoints {
  if (whole === 0) return 0;
  return roundHalfEven((part * BP_DENOMINATOR) / whole);
}

/**
 * Split `total` across `weights` proportionally so that the parts sum exactly to `total`.
 * Remainders are distributed to the largest fractional parts first (Hamilton method), which
 * keeps the allocation stable and free of one-cent drift.
 */
export function allocateProportionally(total: Cents, weights: number[]): Cents[] {
  assertCents(total, 'total');
  if (weights.length === 0) return [];
  const weightSum = weights.reduce((a, b) => a + b, 0);
  if (weightSum <= 0) {
    const even = Math.trunc(total / weights.length);
    const parts = weights.map(() => even);
    let remainder = total - even * weights.length;
    for (let i = 0; remainder !== 0 && i < parts.length; i++) {
      const step = remainder > 0 ? 1 : -1;
      parts[i] = (parts[i] ?? 0) + step;
      remainder -= step;
    }
    return parts;
  }
  const raw = weights.map((w) => (total * w) / weightSum);
  const floored = raw.map((r) => (total >= 0 ? Math.floor(r) : Math.ceil(r)));
  let remainder = total - floored.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: Math.abs(r - (floored[i] ?? 0)) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  const step = remainder > 0 ? 1 : -1;
  for (const { i } of order) {
    if (remainder === 0) break;
    floored[i] = (floored[i] ?? 0) + step;
    remainder -= step;
  }
  return floored;
}

export function centsToDecimalString(cents: Cents, decimals = 2): string {
  assertCents(cents);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  if (decimals === 0) return `${negative ? '-' : ''}${abs}`;
  const factor = 10 ** decimals;
  const whole = Math.trunc(abs / factor);
  const frac = String(abs % factor).padStart(decimals, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

function groupThousands(digits: string, separator: string): string {
  let out = '';
  let count = 0;
  for (let i = digits.length - 1; i >= 0; i--) {
    out = digits[i] + out;
    count++;
    if (count % 3 === 0 && i > 0) out = separator + out;
  }
  return out;
}

export interface FormatMoneyOptions {
  /** Show the currency symbol (default true). */
  symbol?: boolean;
  /** Render negative values with parentheses instead of a minus sign. */
  accounting?: boolean;
  /** Drop the fractional part when it is zero. */
  compactZeroCents?: boolean;
  /** Always render a sign, even for positive numbers. */
  explicitSign?: boolean;
}

/**
 * Deterministic money formatter. We deliberately avoid Intl so that the output is identical on
 * every runtime (tests, server-rendered documents and the browser).
 */
export function formatMoney(cents: Cents, currency: string, options: FormatMoneyOptions = {}): string {
  assertCents(cents);
  const info = currencyInfo(currency);
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const factor = 10 ** info.decimals;
  const whole = groupThousands(String(Math.trunc(abs / factor)), ',');
  let fraction = info.decimals > 0 ? String(abs % factor).padStart(info.decimals, '0') : '';
  if (options.compactZeroCents && /^0*$/.test(fraction)) fraction = '';
  const body = fraction ? `${whole}.${fraction}` : whole;
  const symbol = options.symbol === false ? '' : info.symbol;
  const spaced = symbol.length > 1 && /[A-Za-z]/.test(symbol) ? `${symbol} ` : symbol;
  if (negative) {
    return options.accounting ? `(${spaced}${body})` : `-${spaced}${body}`;
  }
  return `${options.explicitSign && cents > 0 ? '+' : ''}${spaced}${body}`;
}

/** Compact form for charts and KPI tiles: $12.4k, $1.2M. */
export function formatMoneyCompact(cents: Cents, currency: string): string {
  const info = currencyInfo(currency);
  const units = cents / 10 ** info.decimals;
  const abs = Math.abs(units);
  const sign = units < 0 ? '-' : '';
  const symbol = info.symbol;
  if (abs >= 1_000_000) return `${sign}${symbol}${trimTrailingZero((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 10_000) return `${sign}${symbol}${trimTrailingZero((abs / 1_000).toFixed(1))}k`;
  if (abs >= 1_000) return `${sign}${symbol}${trimTrailingZero((abs / 1_000).toFixed(2))}k`;
  return formatMoney(cents, currency, { compactZeroCents: true });
}

function trimTrailingZero(value: string): string {
  return value.replace(/\.0+$/, '').replace(/(\.\d*[1-9])0+$/, '$1');
}

/**
 * Parse a user-entered amount ("1,250.50", "$99", "-12", "1 200") into cents.
 * Returns null when the input is not a valid amount.
 */
export function parseMoneyInput(input: string, decimals = 2): Cents | null {
  if (typeof input !== 'string') return null;
  let s = input.trim();
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^\d.,\-+]/g, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  } else if (s.startsWith('+')) {
    s = s.slice(1);
  }
  if (!s) return null;
  // Decide which separator is decimal: the last one, if it is followed by <= `decimals` digits.
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);
  let whole = s;
  let frac = '';
  if (lastSep >= 0 && s.length - lastSep - 1 <= Math.max(decimals, 1) && s.length - lastSep - 1 > 0) {
    whole = s.slice(0, lastSep);
    frac = s.slice(lastSep + 1);
  } else if (lastSep >= 0 && s.length - lastSep - 1 === 0) {
    whole = s.slice(0, lastSep);
  }
  whole = whole.replace(/[.,]/g, '');
  if (!/^\d*$/.test(whole) || !/^\d*$/.test(frac)) return null;
  if (!whole && !frac) return null;
  const factor = 10 ** decimals;
  const fracPadded = (frac + '0'.repeat(decimals)).slice(0, decimals);
  const cents = Number(whole || '0') * factor + (decimals > 0 ? Number(fracPadded || '0') : 0);
  if (!Number.isSafeInteger(cents)) return null;
  return negative ? -cents : cents;
}

export function formatBp(bp: BasisPoints, options: { decimals?: number } = {}): string {
  const decimals = options.decimals ?? 2;
  const pct = bp / 100;
  const fixed = pct.toFixed(decimals);
  return `${trimTrailingZero(fixed)}%`;
}

export function parseBpInput(input: string): BasisPoints | null {
  const s = input.trim().replace('%', '');
  if (!/^-?\d+(\.\d+)?$/.test(s)) return null;
  const bp = Math.round(Number(s) * 100);
  return Number.isSafeInteger(bp) ? bp : null;
}

export function percentChangeBp(current: Cents, previous: Cents): BasisPoints | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return roundHalfEven(((current - previous) * BP_DENOMINATOR) / Math.abs(previous));
}

export function clampCents(value: Cents, min: Cents, max: Cents): Cents {
  return Math.min(Math.max(value, min), max);
}
