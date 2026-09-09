import { Link } from 'react-router-dom';
import { formatBp, percentChangeBp, type ReportSection } from '@ledgerline/shared';
import { Money } from '../../components/Money';
import { useWorkspace } from '../../hooks/useWorkspace';
import { cx } from '../../lib/cx';

export function DeltaCell({ current, previous }: { current: number; previous: number }) {
  const bp = percentChangeBp(current, previous);
  if (bp == null) return <span className="muted">—</span>;
  return (
    <span className={cx(bp > 0 && 'tone-positive', bp < 0 && 'tone-negative')}>
      {bp === 0 ? '0%' : `${bp > 0 ? '+' : ''}${formatBp(bp, { decimals: 1 })}`}
    </span>
  );
}

export function StatementHeader({
  compare,
  labels,
}: {
  compare: boolean;
  labels: { current: string; previous?: string };
}) {
  return (
    <div
      className={cx('statement__line statement__line--head', compare && 'statement__line--compare')}
    >
      <span>Code</span>
      <span>Account</span>
      <span className="is-right">{labels.current}</span>
      {compare ? <span className="is-right">{labels.previous ?? 'Previous'}</span> : null}
      {compare ? <span className="is-right">Change</span> : null}
    </div>
  );
}

export function StatementSection({
  section,
  compare,
  totalLabel,
}: {
  section: ReportSection;
  compare?: boolean;
  totalLabel?: string;
}) {
  const { currency, base } = useWorkspace();
  const cmp = Boolean(compare && section.previousTotalCents != null);
  return (
    <section className="statement__section">
      <h3 className="statement__section-title">{section.title}</h3>
      {section.lines.length === 0 ? (
        <div className="statement__line">
          <span />
          <span className="muted">No activity</span>
          <span className="is-right">
            <Money cents={0} currency={currency} muteZero />
          </span>
        </div>
      ) : (
        section.lines.map((l) => (
          <div
            key={l.accountId}
            className={cx('statement__line', cmp && 'statement__line--compare')}
          >
            <span className="statement__code">{l.code}</span>
            <span>
              <Link to={`${base}/ledger/accounts/${l.accountId}`}>{l.name}</Link>
            </span>
            <span className="is-right">
              <Money cents={l.amountCents} currency={currency} />
            </span>
            {cmp ? (
              <span className="is-right">
                <Money cents={l.previousCents ?? 0} currency={currency} muteZero />
              </span>
            ) : null}
            {cmp ? (
              <span className="is-right small">
                <DeltaCell current={l.amountCents} previous={l.previousCents ?? 0} />
              </span>
            ) : null}
          </div>
        ))
      )}
      <div
        className={cx('statement__line statement__line--total', cmp && 'statement__line--compare')}
      >
        <span />
        <span>{totalLabel ?? `Total ${section.title.toLowerCase()}`}</span>
        <span className="is-right">
          <Money cents={section.totalCents} currency={currency} />
        </span>
        {cmp ? (
          <span className="is-right">
            <Money cents={section.previousTotalCents ?? 0} currency={currency} />
          </span>
        ) : null}
        {cmp ? (
          <span className="is-right small">
            <DeltaCell current={section.totalCents} previous={section.previousTotalCents ?? 0} />
          </span>
        ) : null}
      </div>
    </section>
  );
}

export function GrandTotal({
  label,
  cents,
  previous,
  compare,
  hint,
}: {
  label: string;
  cents: number;
  previous?: number | null;
  compare?: boolean;
  hint?: string;
}) {
  const { currency } = useWorkspace();
  const cmp = Boolean(compare && previous != null);
  return (
    <div
      className={cx('statement__line statement__line--grand', cmp && 'statement__line--compare')}
    >
      <span />
      <span>
        {label}
        {hint ? (
          <span className="muted small" style={{ fontFamily: 'var(--font-sans)', marginLeft: 8 }}>
            {hint}
          </span>
        ) : null}
      </span>
      <span className="is-right">
        <Money cents={cents} currency={currency} />
      </span>
      {cmp ? (
        <span className="is-right">
          <Money cents={previous ?? 0} currency={currency} />
        </span>
      ) : null}
      {cmp ? (
        <span className="is-right small">
          <DeltaCell current={cents} previous={previous ?? 0} />
        </span>
      ) : null}
    </div>
  );
}
