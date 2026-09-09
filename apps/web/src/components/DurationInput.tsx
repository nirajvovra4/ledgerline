import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { minutesToDuration, parseDuration } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface DurationInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size'
> {
  /** Whole minutes; null when empty/invalid. */
  value: number | null;
  onChange: (minutes: number | null) => void;
  invalid?: boolean;
  size?: 'sm' | 'md';
}

/** Accepts "1h 30m", "1:30", "90m", "1.5" and stores minutes. Normalises to "1h 30m" on blur. */
export function DurationInput({
  value,
  onChange,
  invalid,
  size = 'md',
  className,
  onBlur,
  placeholder = '1h 30m',
  ...rest
}: DurationInputProps) {
  const [text, setText] = useState(value == null ? '' : minutesToDuration(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : minutesToDuration(value));
  }, [value, focused]);
  const parsedInvalid = text.trim() !== '' && parseDuration(text) == null;
  return (
    <input
      inputMode="text"
      autoComplete="off"
      placeholder={placeholder}
      className={cx(
        'input',
        'input--duration',
        (invalid || parsedInvalid) && 'input--invalid',
        size === 'sm' && 'input--sm',
        className,
      )}
      value={text}
      aria-invalid={invalid || parsedInvalid || undefined}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        onChange(parseDuration(e.target.value));
      }}
      onBlur={(e) => {
        setFocused(false);
        const mins = parseDuration(text);
        if (mins != null) setText(minutesToDuration(mins));
        onBlur?.(e);
      }}
      {...rest}
    />
  );
}
