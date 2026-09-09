import { useEffect, useState, type InputHTMLAttributes } from 'react';
import {
  centsToDecimalString,
  currencyInfo,
  parseMoneyInput,
  type Cents,
} from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface MoneyInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size'
> {
  /** Cents; null when empty or invalid. */
  value: Cents | null;
  onChange: (cents: Cents | null) => void;
  currency: string;
  invalid?: boolean;
  size?: 'sm' | 'md';
  allowNegative?: boolean;
  showSymbol?: boolean;
}

/**
 * Edits an integer cents value through free text ("1,250.5", "$99", "(12)"). The text is only
 * reformatted on blur so typing is never interrupted.
 */
export function MoneyInput({
  value,
  onChange,
  currency,
  invalid,
  size = 'md',
  allowNegative = true,
  showSymbol = true,
  className,
  onBlur,
  onFocus,
  ...rest
}: MoneyInputProps) {
  const info = currencyInfo(currency);
  const format = (cents: Cents | null) =>
    cents == null ? '' : centsToDecimalString(cents, info.decimals);
  const [text, setText] = useState<string>(() => format(value));
  const [focused, setFocused] = useState(false);

  // Keep the field in sync with external value changes while not being edited.
  useEffect(() => {
    if (!focused) setText(format(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, focused, info.decimals]);

  const parsedInvalid = text.trim() !== '' && parseMoneyInput(text, info.decimals) == null;

  const input = (
    <input
      inputMode="decimal"
      autoComplete="off"
      className={cx(
        'input',
        'input--money',
        (invalid || parsedInvalid) && 'input--invalid',
        size === 'sm' && 'input--sm',
        className,
      )}
      value={text}
      aria-invalid={invalid || parsedInvalid || undefined}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const cents = parseMoneyInput(next, info.decimals);
        if (cents == null) {
          onChange(null);
        } else if (!allowNegative && cents < 0) {
          onChange(Math.abs(cents));
        } else {
          onChange(cents);
        }
      }}
      onBlur={(e) => {
        setFocused(false);
        const cents = parseMoneyInput(text, info.decimals);
        setText(
          cents == null
            ? text.trim()
              ? text
              : ''
            : format(!allowNegative && cents < 0 ? Math.abs(cents) : cents),
        );
        onBlur?.(e);
      }}
      {...rest}
    />
  );
  if (!showSymbol) return input;
  return (
    <span className="input-affix input-affix--prefix">
      <span className="input-affix__prefix">{info.symbol}</span>
      {input}
    </span>
  );
}
