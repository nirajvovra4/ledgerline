import { cx } from '../lib/cx';

export function Progress({
  value,
  max = 1,
  tone,
  label,
}: {
  value: number;
  max?: number;
  tone?: 'positive' | 'warning' | 'negative';
  label?: string;
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className={cx('progress__fill', tone && `progress__fill--${tone}`)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function ShareBar({ bp, tone }: { bp: number; tone?: 'positive' | 'warning' | 'negative' }) {
  const pct = Math.max(0, Math.min(100, bp / 100));
  return (
    <div className="share-bar" aria-hidden="true">
      <div
        className={cx('share-bar__fill', tone && `share-bar__fill--${tone}`)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
