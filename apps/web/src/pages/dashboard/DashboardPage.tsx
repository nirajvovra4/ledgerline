import { useNavigate } from 'react-router-dom';
import {
  formatDate,
  formatDateRange,
  formatRelative,
  type DashboardRange,
  type InvoiceDto,
} from '@ledgerline/shared';
import { useDashboard } from '../../api/workspaces';
import { LinkButton } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { DonutChart, StackedBarChart } from '../../components/charts';
import { ErrorState } from '../../components/ErrorState';
import { EventList } from '../../components/EventList';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Segmented } from '../../components/Segmented';
import { Skeleton, SkeletonRows } from '../../components/Skeleton';
import { InvoiceStamp } from '../../components/StatusStamp';
import { Timeline } from '../../components/Timeline';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useWorkspace } from '../../hooks/useWorkspace';
import { activityToTimeline } from '../../lib/activity';
import { KpiGrid } from './KpiGrid';
import { TopClients } from './TopClients';

const RANGE_DEFAULTS = { range: 'month' } as const;

export function DashboardPage() {
  const { workspace, money, base, currency } = useWorkspace();
  const [params, setParams] = useQueryParams<{ range: string }>(RANGE_DEFAULTS);
  const range = (
    ['month', 'quarter', 'year'].includes(params.range) ? params.range : 'month'
  ) as DashboardRange;
  const dash = useDashboard(range);
  const navigate = useNavigate();

  const invoiceColumns: Column<InvoiceDto>[] = [
    {
      key: 'number',
      header: 'Number',
      render: (r) => <span className="table__primary">{r.number}</span>,
    },
    { key: 'client', header: 'Client', render: (r) => r.clientName },
    { key: 'status', header: 'Status', render: (r) => <InvoiceStamp status={r.derivedStatus} /> },
    {
      key: 'total',
      header: 'Total',
      money: true,
      render: (r) => <Money cents={r.totalCents} currency={currency} />,
    },
    {
      key: 'balance',
      header: 'Balance',
      money: true,
      render: (r) => <Money cents={r.balanceCents} currency={currency} muteZero />,
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle={
          dash.data
            ? `${formatDateRange({ from: dash.data.from, to: dash.data.to })} · today is ${formatDate(dash.data.today)}`
            : workspace.name
        }
        actions={
          <Segmented
            ariaLabel="Period"
            value={range}
            onChange={(v) => setParams({ range: v })}
            options={[
              { value: 'month', label: 'Month' },
              { value: 'quarter', label: 'Quarter' },
              { value: 'year', label: 'Year' },
            ]}
          />
        }
        primary={
          <LinkButton to={`${base}/invoices/new`} variant="primary">
            New invoice
          </LinkButton>
        }
      />
      {dash.isLoading ? (
        <div className="stack">
          <div className="dash__kpis">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} height={72} />
            ))}
          </div>
          <SkeletonRows rows={6} />
        </div>
      ) : dash.error ? (
        <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
      ) : dash.data ? (
        <>
          <KpiGrid kpis={dash.data.kpis} />
          <div className="dash__grid">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Cash flow</h2>
                <span className="muted small">money in vs out per month</span>
              </div>
              <div className="paper__body">
                <StackedBarChart
                  ariaLabel="Cash flow by month"
                  series={[
                    { key: 'in', label: 'In', color: 'var(--moss)' },
                    { key: 'out', label: 'Out', color: 'var(--red)' },
                  ]}
                  data={dash.data.cashflow.map((c) => ({
                    label: c.label,
                    values: { in: c.inCents, out: c.outCents },
                  }))}
                  format={(v) => money.compact(v)}
                  emptyLabel="No cash movements in this period."
                />
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Receivables aging</h2>
                <LinkButton size="sm" variant="ghost" to={`${base}/reports/ar-aging`}>
                  Report
                </LinkButton>
              </div>
              <div className="paper__body">
                <DonutChart
                  ariaLabel="Receivables by age"
                  slices={dash.data.aging.map((a, i) => ({
                    key: a.bucket,
                    label: a.label,
                    value: a.amountCents,
                    sub: `${a.count}`,
                    color: ['var(--moss)', 'var(--amber)', '#c9862b', 'var(--red)', '#7a2a20'][i],
                  }))}
                  format={(v) => money.compact(v)}
                  centerLabel="Outstanding"
                  centerValue={money.compact(dash.data.kpis.outstandingCents)}
                />
              </div>
            </section>
          </div>
          <div className="dash__grid">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Recent invoices</h2>
                <LinkButton size="sm" variant="ghost" to={`${base}/invoices`}>
                  All invoices
                </LinkButton>
              </div>
              <DataTable
                columns={invoiceColumns}
                rows={dash.data.recentInvoices}
                rowKey={(r) => r.id}
                onRowClick={(r) => navigate(`${base}/invoices/${r.id}`)}
                empty={{
                  title: 'No invoices yet',
                  description: 'Create your first invoice to see it here.',
                }}
                flush
                compact
              />
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Top clients</h2>
                <LinkButton size="sm" variant="ghost" to={`${base}/reports/revenue-by-client`}>
                  Report
                </LinkButton>
              </div>
              <div className="paper__body">
                <TopClients clients={dash.data.topClients} />
              </div>
            </section>
          </div>
          <div className="dash__grid">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Activity</h2>
              </div>
              <div className="paper__body dash__activity">
                <Timeline items={activityToTimeline(dash.data.recentActivity)} />
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Upcoming</h2>
                <LinkButton size="sm" variant="ghost" to={`${base}/calendar`}>
                  Calendar
                </LinkButton>
              </div>
              <div className="paper__body">
                <EventList
                  events={dash.data.upcoming.map((e) => ({
                    ...e,
                    subtitle: `${formatRelative(e.date, dash.data!.today)} · ${e.subtitle}`,
                  }))}
                  emptyLabel="Nothing due in the coming days."
                />
              </div>
            </section>
          </div>
        </>
      ) : null}
    </>
  );
}
