import { formatBp } from '@ledgerline/shared';
import { useTaxSummary } from '../../api/reports';
import { Money } from '../../components/Money';
import { Stat } from '../../components/Stat';
import { Table } from '../../components/Table';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportRange } from './ReportFrame';

function RateTable({
  title,
  rows,
  currency,
}: {
  title: string;
  rows: Array<{
    taxRateId: string | null;
    name: string;
    rateBp: number;
    netCents: number;
    taxCents: number;
  }>;
  currency: string;
}) {
  const net = rows.reduce((s, r) => s + r.netCents, 0);
  const tax = rows.reduce((s, r) => s + r.taxCents, 0);
  return (
    <section className="statement__section">
      <h3 className="statement__section-title">{title}</h3>
      <Table compact flush>
        <thead>
          <tr>
            <th>Rate</th>
            <th className="is-right">%</th>
            <th className="is-money">Net</th>
            <th className="is-money">Tax</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={4} className="table__state">
                Nothing in this period.
              </td>
            </tr>
          ) : (
            rows.map((r) => (
              <tr key={r.taxRateId ?? `bp-${r.rateBp}`}>
                <td>{r.name}</td>
                <td className="is-right">{formatBp(r.rateBp)}</td>
                <td className="is-money">
                  <Money cents={r.netCents} currency={currency} />
                </td>
                <td className="is-money">
                  <Money cents={r.taxCents} currency={currency} />
                </td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2}>Total</td>
            <td className="is-money">
              <Money cents={net} currency={currency} />
            </td>
            <td className="is-money">
              <Money cents={tax} currency={currency} />
            </td>
          </tr>
        </tfoot>
      </Table>
    </section>
  );
}

export function TaxSummaryPage() {
  const [range, setRange] = useReportRange('this_quarter');
  const { currency, money } = useWorkspace();
  const query = useTaxSummary(range);
  return (
    <ReportFrame
      title="Tax summary"
      description="Sales tax collected on approved invoices versus input tax paid on approved expenses."
      query={query}
      range={{ value: range, onChange: setRange }}
    >
      {(data) => (
        <>
          <div className="stat-strip" style={{ marginBottom: 24 }}>
            <Stat label="Collected" value={money.fmt(data.collectedCents)} size="sm" />
            <Stat label="Paid" value={money.fmt(data.paidCents)} size="sm" />
            <Stat
              label={data.netPayableCents >= 0 ? 'Net payable' : 'Net refundable'}
              value={money.fmt(Math.abs(data.netPayableCents))}
              size="sm"
              tone={data.netPayableCents > 0 ? 'warning' : 'positive'}
            />
          </div>
          <RateTable title="Collected on sales" rows={data.collected} currency={currency} />
          <RateTable title="Paid on purchases" rows={data.paid} currency={currency} />
        </>
      )}
    </ReportFrame>
  );
}
