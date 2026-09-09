import { Link } from 'react-router-dom';
import { humanize } from '@ledgerline/shared';
import { useTrialBalance } from '../../api/reports';
import { Money } from '../../components/Money';
import { Table } from '../../components/Table';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportAsOf } from './ReportFrame';

export function TrialBalancePage() {
  const [asOf, setAsOf] = useReportAsOf();
  const { currency, base } = useWorkspace();
  const query = useTrialBalance(asOf);
  return (
    <ReportFrame
      title="Trial balance"
      description="Cumulative net balance of every account. Debits must equal credits."
      query={query}
      asOf={{ value: asOf, onChange: setAsOf }}
    >
      {(data) => (
        <>
          <Table compact flush>
            <thead>
              <tr>
                <th>Code</th>
                <th>Account</th>
                <th>Type</th>
                <th className="is-money">Debit</th>
                <th className="is-money">Credit</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table__state">
                    Nothing posted as of this date.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.accountId}>
                    <td className="mono muted">{r.code}</td>
                    <td>
                      <Link to={`${base}/ledger/accounts/${r.accountId}`}>{r.name}</Link>
                    </td>
                    <td className="muted">{humanize(r.type)}</td>
                    <td className="is-money">
                      {r.debitCents ? <Money cents={r.debitCents} currency={currency} /> : null}
                    </td>
                    <td className="is-money">
                      {r.creditCents ? <Money cents={r.creditCents} currency={currency} /> : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3}>Totals</td>
                <td className="is-money">
                  <Money cents={data.totalDebitCents} currency={currency} />
                </td>
                <td className="is-money">
                  <Money cents={data.totalCreditCents} currency={currency} />
                </td>
              </tr>
            </tfoot>
          </Table>
          <p
            className={`small ${data.balanced ? 'tone-positive' : 'tone-negative'}`}
            style={{ marginTop: 16 }}
          >
            {data.balanced ? '✓ In balance.' : '✗ Out of balance.'}
          </p>
        </>
      )}
    </ReportFrame>
  );
}
