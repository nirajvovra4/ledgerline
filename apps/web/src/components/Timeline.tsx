import type { ReactNode } from 'react';
import type { Tone } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface TimelineItem {
  key: string;
  title: ReactNode;
  meta?: ReactNode;
  body?: ReactNode;
  tone?: Tone;
}

export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  if (items.length === 0) return <p className="muted small">No history yet.</p>;
  return (
    <ol className={cx('timeline', className)}>
      {items.map((it) => (
        <li key={it.key} className="timeline__item">
          <span
            className={cx('timeline__dot', it.tone && `timeline__dot--${it.tone}`)}
            aria-hidden="true"
          />
          <div className="timeline__title">{it.title}</div>
          {it.meta ? <div className="timeline__meta">{it.meta}</div> : null}
          {it.body ? <div className="timeline__body">{it.body}</div> : null}
        </li>
      ))}
    </ol>
  );
}
