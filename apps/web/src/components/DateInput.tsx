import { forwardRef, type InputHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface DateInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type' | 'size'
> {
  /** ISO YYYY-MM-DD or '' when empty. */
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  size?: 'sm' | 'md';
}

export const DateInput = forwardRef<HTMLInputElement, DateInputProps>(function DateInput(
  { value, onChange, invalid, size = 'md', className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      type="date"
      className={cx('input', invalid && 'input--invalid', size === 'sm' && 'input--sm', className)}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(e.target.value)}
      {...rest}
    />
  );
});
