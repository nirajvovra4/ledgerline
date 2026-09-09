import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface SwitchProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'onChange'
> {
  label?: ReactNode;
  onChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(function Switch(
  { label, className, onChange, checked, ...rest },
  ref,
) {
  return (
    <label className={cx('switch', className)}>
      <input
        ref={ref}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
        {...rest}
      />
      <span className="switch__track" aria-hidden="true" />
      {label ? <span>{label}</span> : null}
    </label>
  );
});
