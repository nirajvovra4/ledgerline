import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

/** Plain table wrapper for static content (document lines, report rows). */
export function Table({
  children,
  className,
  compact,
  flush,
  ...rest
}: HTMLAttributes<HTMLTableElement> & { compact?: boolean; flush?: boolean; children: ReactNode }) {
  return (
    <div className={cx('table-wrap', flush && 'table-wrap--flush')}>
      <table className={cx('table', compact && 'table--compact', className)} {...rest}>
        {children}
      </table>
    </div>
  );
}
