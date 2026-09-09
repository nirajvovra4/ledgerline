import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { formatBp, percentChangeBp, type Cents, type Tone } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  tone?: Tone;
  to?: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Stat({ label, value, sub, tone, to, size = 'md', className }: StatProps) {
  const body = (
    <>
      <div className="stat__label">{label}</div>
      <div className={cx('stat__value', size === 'sm' && 'stat__value--sm')}>{value}</div>
      {sub ? <div className="stat__sub">{sub}</div> : null}
    </>
  );
  const cls = cx('stat', tone && `stat--${tone}`, className);
  if (to) {
    return (
      <Link to={to} className={cx(cls, 'stat--link')}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

/** Percentage delta vs a previous value; `invert` treats a decrease as good (e.g. expenses). */
export function Delta({
  current,
  previous,
  invert,
}: {
  current: Cents;
  previous: Cents;
  invert?: boolean;
}) {
  const bp = percentChangeBp(current, previous);
  if (bp == null) return <span className="stat__delta muted">new</span>;
  if (bp === 0) return <span className="stat__delta muted">±0%</span>;
  const good = invert ? bp < 0 : bp > 0;
  return (
    <span className={cx('stat__delta', good ? 'stat__delta--up' : 'stat__delta--down')}>
      {bp > 0 ? '▲' : '▼'} {formatBp(Math.abs(bp), { decimals: 1 })}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  current,
  previous,
  invert,
  sub,
  tone,
  to,
}: {
  label: ReactNode;
  value: ReactNode;
  current?: Cents;
  previous?: Cents;
  invert?: boolean;
  sub?: ReactNode;
  tone?: Tone;
  to?: string;
}) {
  const delta =
    current != null && previous != null ? (
      <Delta current={current} previous={previous} invert={invert} />
    ) : null;
  return (
    <Stat
      label={label}
      value={value}
      tone={tone}
      to={to}
      sub={
        delta || sub ? (
          <>
            {delta}
            {delta && sub ? <span className="muted">·</span> : null}
            {sub}
          </>
        ) : undefined
      }
    />
  );
}
