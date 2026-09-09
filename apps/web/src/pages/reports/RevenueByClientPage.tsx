import { Link } from 'react-router-dom';
import { formatBp } from '@ledgerline/shared';
import { useRevenueByClient } from '../../api/reports';
import { Money } from '../../components/Money';
import { ShareBar } from '../../components/Progress';
import { Table } from '../../components/Table';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportRange } from './ReportFrame';

export function RevenueByClientPage() {
  const [range, setRange] = useReportRange('this_year');
  const { currency, base } = useWorkspace();
  const query = useRevenueByClient(range);
  return (
    <ReportFrame
      title="Revenue by client"
      description="Invoiced amounts by client in the period, with collection status."
      query={query}
      range={{ value: range, onChange: setRange }}
    >
      {(data) => (
        <Table compact flush>
          <thead>
            <tr>
              <th>Client</th>
              <th style={{ width: 180 }}>Share</th>
              <th className="is-right">Invoices</th>
              <th className="is-money">Invoiced</th>
              <th className="is-money">Paid</th>
              <th className="is-money">Outstanding</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="table__state">
                  No invoices in this period.
                </td>
              </tr>
            ) : (
              data.rows.map((r) => (
                <tr key={r.clientId}>
                  <td>
                    <Link to={`${base}/clients/${r.clientId}`}>{r.clientName}</Link>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="grow">
                        <ShareBar bp={r.shareBp} />
                      </div>
                      <span className="tiny muted num" style={{ width: 44, textAlign: 'right' }}>
                        {formatBp(r.shareBp, { decimals: 1 })}
                      </span>
                    </div>
                  </td>
                  <td className="is-right">{r.invoiceCount}</td>
                  <td className="is-money">
                    <Money cents={r.invoicedCents} currency={currency} />
                  </td>
                  <td className="is-money">
                    <Money cents={r.paidCents} currency={currency} />
                  </td>
                  <td className="is-money">
                    <Money cents={r.outstandingCents} currency={currency} muteZero />
                  </td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>Total</td>
              <td className="is-money">
                <Money cents={data.totalCents} currency={currency} />
              </td>
              <td className="is-money">
                <Money cents={data.rows.reduce((s, r) => s + r.paidCents, 0)} currency={currency} />
              </td>
              <td className="is-money">
                <Money
                  cents={data.rows.reduce((s, r) => s + r.outstandingCents, 0)}
                  currency={currency}
                />
              </td>
            </tr>
          </tfoot>
        </Table>
      )}
    </ReportFrame>
  );
}
