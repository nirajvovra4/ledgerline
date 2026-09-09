import { minutesToDuration, pluralize, type DashboardDto } from '@ledgerline/shared';
import { KpiTile } from '../../components/Stat';
import { useWorkspace } from '../../hooks/useWorkspace';

export function KpiGrid({ kpis }: { kpis: DashboardDto['kpis'] }) {
  const { money, base } = useWorkspace();
  return (
    <div className="dash__kpis">
      <KpiTile
        label="Outstanding"
        value={money.fmt(kpis.outstandingCents)}
        sub="open invoices"
        to={`${base}/invoices?status=open`}
      />
      <KpiTile
        label="Overdue"
        value={money.fmt(kpis.overdueCents)}
        sub={pluralize(kpis.overdueCount, 'invoice')}
        tone={kpis.overdueCents > 0 ? 'negative' : undefined}
        to={`${base}/invoices?status=overdue`}
      />
      <KpiTile
        label="Revenue"
        value={money.fmt(kpis.revenueCents)}
        current={kpis.revenueCents}
        previous={kpis.previousRevenueCents}
        sub="vs previous"
        to={`${base}/reports/profit-loss`}
      />
      <KpiTile
        label="Expenses"
        value={money.fmt(kpis.expensesCents)}
        current={kpis.expensesCents}
        previous={kpis.previousExpensesCents}
        invert
        sub="vs previous"
        to={`${base}/expenses`}
      />
      <KpiTile
        label="Net"
        value={money.fmt(kpis.netCents)}
        tone={kpis.netCents < 0 ? 'negative' : kpis.netCents > 0 ? 'positive' : undefined}
        sub="revenue − expenses"
      />
      <KpiTile
        label="Unbilled time"
        value={minutesToDuration(kpis.unbilledMinutes)}
        sub={`worth ${money.fmt(kpis.unbilledCents)}`}
        to={`${base}/invoices/from-time`}
      />
      <KpiTile
        label="Drafts"
        value={String(kpis.draftInvoiceCount)}
        sub="invoices in draft"
        to={`${base}/invoices?status=draft`}
      />
      <KpiTile
        label="Pending approvals"
        value={String(kpis.pendingApprovalCount)}
        tone={kpis.pendingApprovalCount > 0 ? 'warning' : undefined}
        sub="awaiting a decision"
        to={`${base}/approvals`}
      />
    </div>
  );
}
