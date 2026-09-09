import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectGroup {
  label: string;
  options: SelectOption[];
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  invalid?: boolean;
  size?: 'sm' | 'md';
  options?: SelectOption[];
  groups?: SelectGroup[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, size = 'md', className, options, groups, placeholder, children, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cx(
        'select',
        invalid && 'select--invalid',
        size === 'sm' && 'select--sm',
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    >
      {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
      {options?.map((o) => (
        <option key={o.value} value={o.value} disabled={o.disabled}>
          {o.label}
        </option>
      ))}
      {groups?.map((g) => (
        <optgroup key={g.label} label={g.label}>
          {g.options.map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>
              {o.label}
            </option>
          ))}
        </optgroup>
      ))}
      {children}
    </select>
  );
});
