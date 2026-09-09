import { formatBp, formatDateRange } from '@ledgerline/shared';
import { useProfitLoss } from '../../api/reports';
import { Checkbox } from '../../components/Checkbox';
import { useQueryParams } from '../../hooks/useQueryParams';
import { ReportFrame, useReportRange } from './ReportFrame';
import { GrandTotal, StatementHeader, StatementSection } from './StatementSection';

const CMP_DEFAULTS = { compare: false };

export function ProfitLossPage() {
  const [range, setRange] = useReportRange('this_year');
  const [cmp, setCmp] = useQueryParams(CMP_DEFAULTS);
  const query = useProfitLoss({
    from: range.from,
    to: range.to,
    compare: cmp.compare ? 'previous' : 'none',
  });
  return (
    <ReportFrame
      title="Profit & loss"
      description="Income statement on an accrual basis: revenue is recognised when invoices are approved."
      query={query}
      range={{ value: range, onChange: setRange }}
      extraControls={
        <Checkbox
          label="Compare to previous period"
          checked={cmp.compare}
          onChange={(e) => setCmp({ compare: e.target.checked })}
        />
      }
    >
      {(data) => {
        const compare = data.compareFrom != null && data.compareTo != null;
        return (
          <>
            <StatementHeader
              compare={compare}
              labels={{
                current: formatDateRange({ from: data.from, to: data.to }),
                previous: compare
                  ? formatDateRange({ from: data.compareFrom!, to: data.compareTo! })
                  : undefined,
              }}
            />
            <StatementSection section={data.revenue} compare={compare} />
            <StatementSection section={data.expenses} compare={compare} />
            <GrandTotal
              label="Net income"
              cents={data.netIncomeCents}
              previous={data.previousNetIncomeCents}
              compare={compare}
              hint={
                data.marginBp != null
                  ? `${formatBp(data.marginBp, { decimals: 1 })} margin`
                  : undefined
              }
            />
          </>
        );
      }}
    </ReportFrame>
  );
}
