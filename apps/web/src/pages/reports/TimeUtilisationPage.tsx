import { formatBp, minutesToDuration } from '@ledgerline/shared';
import { useTimeUtilisation } from '../../api/reports';
import { Money } from '../../components/Money';
import { Stat } from '../../components/Stat';
import { Table } from '../../components/Table';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportRange } from './ReportFrame';

export function TimeUtilisationPage() {
  const [range, setRange] = useReportRange('this_month');
  const { currency, money } = useWorkspace();
  const query = useTimeUtilisation(range);
  return (
    <ReportFrame
      title="Time utilisation"
      description="Billable share of logged time per team member."
      query={query}
      range={{ value: range, onChange: setRange }}
    >
      {(data) => (
        <>
          <div className="stat-strip" style={{ marginBottom: 24 }}>
            <Stat label="Logged" value={minutesToDuration(data.totalMinutes)} size="sm" />
            <Stat label="Billable" value={minutesToDuration(data.billableMinutes)} size="sm" />
            <Stat
              label="Utilisation"
              value={formatBp(data.utilisationBp, { decimals: 0 })}
              size="sm"
              tone={
                data.utilisationBp >= 7000
                  ? 'positive'
                  : data.utilisationBp >= 5000
                    ? 'warning'
                    : 'negative'
              }
            />
            <Stat
              label="Billable value"
              value={money.fmt(data.rows.reduce((s, r) => s + r.billableValueCents, 0))}
              size="sm"
            />
          </div>
          <Table compact flush>
            <thead>
              <tr>
                <th>Member</th>
                <th style={{ width: 220 }}>Utilisation</th>
                <th className="is-right">Logged</th>
                <th className="is-right">Billable</th>
                <th className="is-money">Value</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="table__state">
                    No time logged in this period.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.userId}>
                    <td>{r.name}</td>
                    <td>
                      <div className="row" style={{ gap: 8 }}>
                        <div className="grow share-bar">
                          <div
                            className={`share-bar__fill ${r.utilisationBp >= 7000 ? 'share-bar__fill--positive' : r.utilisationBp >= 5000 ? 'share-bar__fill--warning' : 'share-bar__fill--negative'}`}
                            style={{ width: `${r.utilisationBp / 100}%` }}
                          />
                        </div>
                        <span className="tiny num" style={{ width: 40, textAlign: 'right' }}>
                          {formatBp(r.utilisationBp, { decimals: 0 })}
                        </span>
                      </div>
                    </td>
                    <td className="is-right">{minutesToDuration(r.minutes)}</td>
                    <td className="is-right">{minutesToDuration(r.billableMinutes)}</td>
                    <td className="is-money">
                      <Money cents={r.billableValueCents} currency={currency} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </>
      )}
    </ReportFrame>
  );
}
