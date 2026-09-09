import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size' | 'prefix'> {
  invalid?: boolean;
  size?: 'sm' | 'md';
  prefix?: ReactNode;
  suffix?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, size = 'md', className, prefix, suffix, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      className={cx('input', invalid && 'input--invalid', size === 'sm' && 'input--sm', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
  if (!prefix && !suffix) return input;
  return (
    <span
      className={cx(
        'input-affix',
        prefix && 'input-affix--prefix',
        suffix && 'input-affix--suffix',
      )}
    >
      {prefix ? <span className="input-affix__prefix">{prefix}</span> : null}
      {input}
      {suffix ? <span className="input-affix__suffix">{suffix}</span> : null}
    </span>
  );
});
