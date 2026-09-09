import { useBalanceSheet } from '../../api/reports';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ReportFrame, useReportAsOf } from './ReportFrame';
import { GrandTotal, StatementSection } from './StatementSection';

export function BalanceSheetPage() {
  const [asOf, setAsOf] = useReportAsOf();
  const { money } = useWorkspace();
  const query = useBalanceSheet(asOf);
  return (
    <ReportFrame
      title="Balance sheet"
      description="Statement of financial position. Current earnings are lifetime revenue less expenses, since periods are not closed."
      query={query}
      asOf={{ value: asOf, onChange: setAsOf }}
    >
      {(data) => (
        <>
          <StatementSection section={data.assets} />
          <GrandTotal label="Total assets" cents={data.totalAssetsCents} />
          <div style={{ height: 24 }} />
          <StatementSection section={data.liabilities} />
          <StatementSection section={data.equity} totalLabel="Total equity (contributed)" />
          <div className="statement__line">
            <span />
            <span>Current earnings</span>
            <span className="is-right">{money.fmt(data.currentEarningsCents)}</span>
          </div>
          <GrandTotal
            label="Total liabilities & equity"
            cents={data.totalLiabilitiesAndEquityCents}
          />
          <p
            className={`small ${data.balanced ? 'tone-positive' : 'tone-negative'}`}
            style={{ marginTop: 16 }}
          >
            {data.balanced
              ? '✓ Assets equal liabilities plus equity.'
              : '✗ The books do not balance — check for manual entries posted out of period.'}
          </p>
        </>
      )}
    </ReportFrame>
  );
}
