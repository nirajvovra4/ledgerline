import type { ReactNode } from 'react';
import type { Tone } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export function Badge({
  children,
  tone,
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return <span className={cx('badge', tone && `badge--${tone}`, className)}>{children}</span>;
}

export function CountBadge({ count, label }: { count: number; label?: string }) {
  if (count <= 0) return null;
  return (
    <span className="badge badge--count" aria-label={label ? `${count} ${label}` : undefined}>
      {count > 99 ? '99+' : count}
    </span>
  );
}
