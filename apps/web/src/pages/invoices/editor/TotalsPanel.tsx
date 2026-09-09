import { formatBp } from '@ledgerline/shared';
import { taxRateLabel } from '../../../lib/labels';
import { Money } from '../../../components/Money';
import type { EditorTotals } from './editorState';

export function TotalsPanel({
  totals,
  currency,
  discountBp,
  lineCount,
}: {
  totals: EditorTotals;
  currency: string;
  discountBp: number;
  lineCount: number;
}) {
  return (
    <aside className="totals-panel" aria-label="Invoice totals" data-testid="totals-panel">
      <div className="caps">Totals</div>
      <div className="totals-panel__row">
        <span>
          Subtotal{' '}
          <span className="muted">
            ({lineCount} {lineCount === 1 ? 'line' : 'lines'})
          </span>
        </span>
        <Money cents={totals.subtotalCents} currency={currency} />
      </div>
      {discountBp > 0 ? (
        <div className="totals-panel__row">
          <span>Discount {formatBp(discountBp)}</span>
          <Money cents={-totals.discountCents} currency={currency} />
        </div>
      ) : null}
      {totals.taxRows.map((r) => (
        <div
          key={`${r.taxRateId ?? r.rateBp}`}
          className="totals-panel__row totals-panel__row--sub"
        >
          <span>
            {taxRateLabel(r)} on <Money cents={r.netCents} currency={currency} />
          </span>
          <Money cents={r.taxCents} currency={currency} />
        </div>
      ))}
      <div className="totals-panel__row">
        <span>Tax</span>
        <Money cents={totals.taxCents} currency={currency} />
      </div>
      <div className="totals-panel__row totals-panel__row--total">
        <span>Total</span>
        <Money cents={totals.totalCents} currency={currency} />
      </div>
    </aside>
  );
}
