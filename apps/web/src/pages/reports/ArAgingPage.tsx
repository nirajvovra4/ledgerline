import { Link } from 'react-router-dom';
import { AGING_BUCKETS, pluralize } from '@ledgerline/shared';
import { useArAging } from '../../api/reports';
import { Money } from '../../components/Money';
import { Stat } from '../../components/Stat';
import { Table } from '../../components/Table';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportAsOf } from './ReportFrame';

const TONES = [undefined, 'warning', 'warning', 'negative', 'negative'] as const;

export function ArAgingPage() {
  const [asOf, setAsOf] = useReportAsOf();
  const { currency, money, base } = useWorkspace();
  const query = useArAging(asOf);
  return (
    <ReportFrame
      title="Receivables aging"
      description="Open invoice balances by days past due."
      query={query}
      asOf={{ value: asOf, onChange: setAsOf }}
    >
      {(data) => (
        <>
          <div className="aging-tiles">
            {data.buckets.map((b, i) => (
              <Stat
                key={b.bucket}
                label={b.label}
                value={money.fmt(b.amountCents)}
                sub={pluralize(b.count, 'invoice')}
                size="sm"
                tone={b.amountCents > 0 ? TONES[i] : undefined}
              />
            ))}
          </div>
          <Table compact flush>
            <thead>
              <tr>
                <th>Client</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b.key} className="is-money">
                    {b.label}
                  </th>
                ))}
                <th className="is-money">Total</th>
                <th className="is-right">Oldest</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="table__state">
                    Nothing outstanding — every invoice is paid.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.clientId}>
                    <td>
                      <Link to={`${base}/clients/${r.clientId}?tab=invoices`}>{r.clientName}</Link>
                    </td>
                    {AGING_BUCKETS.map((b) => (
                      <td key={b.key} className="is-money">
                        <Money cents={r.buckets[b.key]} currency={currency} muteZero />
                      </td>
                    ))}
                    <td className="is-money">
                      <strong>
                        <Money cents={r.totalCents} currency={currency} />
                      </strong>
                    </td>
                    <td
                      className={`is-right ${r.oldestDays > 60 ? 'tone-negative' : r.oldestDays > 0 ? 'tone-warning' : 'muted'}`}
                    >
                      {r.oldestDays}d
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                {data.buckets.map((b) => (
                  <td key={b.bucket} className="is-money">
                    <Money cents={b.amountCents} currency={currency} />
                  </td>
                ))}
                <td className="is-money">
                  <Money cents={data.totalCents} currency={currency} />
                </td>
                <td />
              </tr>
            </tfoot>
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
