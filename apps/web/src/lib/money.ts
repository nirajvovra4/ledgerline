import {
  formatMoney,
  formatMoneyCompact,
  type Cents,
  type FormatMoneyOptions,
} from '@ledgerline/shared';

export interface MoneyFormatters {
  currency: string;
  fmt: (cents: Cents, options?: FormatMoneyOptions) => string;
  compact: (cents: Cents) => string;
  /** Accounting style: negatives in parentheses. */
  acct: (cents: Cents) => string;
}

/** Build formatters bound to a currency so pages never repeat the currency argument. */
export function moneyFormatters(currency: string): MoneyFormatters {
  return {
    currency,
    fmt: (cents, options) => formatMoney(cents, currency, options),
    compact: (cents) => formatMoneyCompact(cents, currency),
    acct: (cents) => formatMoney(cents, currency, { accounting: true }),
  };
}

export function sumBy<T>(items: readonly T[], pick: (item: T) => number): number {
  let total = 0;
  for (const item of items) total += pick(item);
  return total;
}

export function clampBp(bp: number): number {
  return Math.min(10_000, Math.max(0, Math.round(bp)));
}
