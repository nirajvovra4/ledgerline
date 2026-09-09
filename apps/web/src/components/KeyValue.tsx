import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface KeyValueItem {
  key: string;
  label: ReactNode;
  value: ReactNode;
}

export function KeyValue({
  items,
  stacked,
  className,
}: {
  items: KeyValueItem[];
  stacked?: boolean;
  className?: string;
}) {
  return (
    <dl className={cx('kv', stacked && 'kv--stacked', className)}>
      {items.map((it) => (
        <div key={it.key} style={{ display: 'contents' }}>
          <dt>{it.label}</dt>
          <dd>{it.value ?? <span className="muted">—</span>}</dd>
        </div>
      ))}
    </dl>
  );
}
