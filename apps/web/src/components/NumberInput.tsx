import { useEffect, useState, type InputHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'size'
> {
  value: number | null;
  onChange: (value: number | null) => void;
  invalid?: boolean;
  size?: 'sm' | 'md';
  decimals?: number;
  suffix?: string;
}

/** Plain numeric input that keeps a number (or null) rather than a string. */
export function NumberInput({
  value,
  onChange,
  invalid,
  size = 'md',
  decimals,
  suffix,
  className,
  onBlur,
  ...rest
}: NumberInputProps) {
  const [text, setText] = useState(value == null ? '' : String(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value == null ? '' : String(value));
  }, [value, focused]);
  const input = (
    <input
      inputMode="decimal"
      className={cx(
        'input',
        'input--number',
        invalid && 'input--invalid',
        size === 'sm' && 'input--sm',
        className,
      )}
      value={text}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.trim().replace(',', '.');
        if (raw === '' || raw === '-' || raw === '.') {
          onChange(null);
          return;
        }
        const n = Number(raw);
        if (!Number.isFinite(n)) {
          onChange(null);
          return;
        }
        onChange(decimals != null ? Number(n.toFixed(decimals)) : n);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      {...rest}
    />
  );
  if (!suffix) return input;
  return (
    <span className="input-affix input-affix--suffix">
      {input}
      <span className="input-affix__suffix">{suffix}</span>
    </span>
  );
}
