import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

export function EmptyState({
  title,
  description,
  action,
  flush,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  className?: string;
}) {
  return (
    <div className={cx('empty', flush && 'empty--flush', className)}>
      <div className="empty__title">{title}</div>
      {description ? <p className="empty__body">{description}</p> : null}
      {action}
    </div>
  );
}
