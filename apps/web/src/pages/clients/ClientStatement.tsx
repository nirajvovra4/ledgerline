import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatDateRange, type DateRange } from '@ledgerline/shared';
import { useClientStatement } from '../../api/clients';
import { Button } from '../../components/Button';
import { DateRangePicker } from '../../components/DateRangePicker';
import { ErrorState } from '../../components/ErrorState';
import { IconPrint } from '../../components/Icons';
import { Money } from '../../components/Money';
import { SkeletonRows } from '../../components/Skeleton';
import { Table } from '../../components/Table';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { rangeForPreset } from '../../lib/dates';
import { printPage } from '../../lib/print';

export function ClientStatement({ clientId }: { clientId: string }) {
  const today = useToday();
  const { workspace, currency, base, settings } = useWorkspace();
  const [range, setRange] = useState<DateRange>(() =>
    rangeForPreset('this_year', today, settings.fiscalYearStartMonth)!,
  );
  const query = useClientStatement(clientId, range);

  return (
    <div className="stack">
      <div className="row row--between row--wrap no-print">
        <DateRangePicker
          value={range}
          onChange={setRange}
          today={today}
          fiscalYearStartMonth={settings.fiscalYearStartMonth}
        />
        <Button icon={<IconPrint />} onClick={printPage}>
          Print
        </Button>
      </div>
      {query.isLoading ? (
        <SkeletonRows rows={6} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className="statement">
          <div className="statement__head">
            <div className="statement__ws">{workspace.name}</div>
            <div className="statement__title">Statement of account</div>
            <div className="statement__period">
              {query.data.client.name} ·{' '}
              {formatDateRange({ from: query.data.from, to: query.data.to })}
            </div>
          </div>
          <Table compact flush>
            <thead>
              <tr>
                <th>Date</th>
                <th>Reference</th>
                <th>Description</th>
                <th className="is-money">Debit</th>
                <th className="is-money">Credit</th>
                <th className="is-money">Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{formatDate(query.data.from)}</td>
                <td />
                <td className="muted">Opening balance</td>
                <td />
                <td />
                <td className="is-money">
                  <Money cents={query.data.openingBalanceCents} currency={currency} />
                </td>
              </tr>
              {query.data.rows.map((r, i) => (
                <tr key={`${r.reference}-${i}`}>
                  <td>{formatDate(r.date)}</td>
                  <td>
                    {r.link ? (
                      <Link to={r.link.startsWith('/') ? r.link : `${base}/${r.link}`}>
                        {r.reference}
                      </Link>
                    ) : (
                      r.reference
                    )}
                  </td>
                  <td className="is-wrap">{r.description}</td>
                  <td className="is-money">
                    {r.debitCents ? <Money cents={r.debitCents} currency={currency} /> : null}
                  </td>
                  <td className="is-money">
                    {r.creditCents ? <Money cents={r.creditCents} currency={currency} /> : null}
                  </td>
                  <td className="is-money">
                    <Money cents={r.balanceCents} currency={currency} />
                  </td>
                </tr>
              ))}
              {query.data.rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table__state">
                    No activity in this period.
                  </td>
                </tr>
              ) : null}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5}>Closing balance</td>
                <td className="is-money">
                  <Money cents={query.data.closingBalanceCents} currency={currency} />
                </td>
              </tr>
            </tfoot>
          </Table>
        </div>
      ) : null}
    </div>
  );
}
