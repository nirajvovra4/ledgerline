import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface SegmentedOption<K extends string> {
  value: K;
  label: ReactNode;
}

export function Segmented<K extends string>({
  options,
  value,
  onChange,
  size,
  ariaLabel,
  className,
}: {
  options: SegmentedOption<K>[];
  value: K;
  onChange: (value: K) => void;
  size?: 'sm';
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cx('segmented', size === 'sm' && 'segmented--sm', className)}
      role="radiogroup"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={cx('segmented__item', o.value === value && 'is-active')}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
