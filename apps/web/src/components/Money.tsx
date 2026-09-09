import { formatMoney, type Cents, type FormatMoneyOptions } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface MoneyProps extends FormatMoneyOptions {
  cents: Cents;
  currency: string;
  /** Render zero in muted grey. */
  muteZero?: boolean;
  className?: string;
  /** Colour positives green (for deltas). */
  signed?: boolean;
}

/** Tabular money with negatives in ledger red. */
export function Money({ cents, currency, muteZero, className, signed, ...options }: MoneyProps) {
  return (
    <span
      className={cx(
        'money',
        cents < 0 && 'money--negative',
        signed && cents > 0 && 'tone-positive',
        muteZero && cents === 0 && 'money--muted',
        className,
      )}
    >
      {formatMoney(cents, currency, options)}
    </span>
  );
}
