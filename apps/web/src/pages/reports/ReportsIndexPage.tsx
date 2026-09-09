import { Link } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { useWorkspace } from '../../hooks/useWorkspace';

const REPORTS = [
  {
    to: 'profit-loss',
    title: 'Profit & loss',
    desc: 'Revenue and expenses for a period, with an optional comparison to the previous period.',
  },
  {
    to: 'balance-sheet',
    title: 'Balance sheet',
    desc: 'Assets, liabilities and equity as of a date, including current earnings.',
  },
  {
    to: 'trial-balance',
    title: 'Trial balance',
    desc: 'Every account’s net debit or credit position — the books must balance.',
  },
  {
    to: 'ar-aging',
    title: 'Receivables aging',
    desc: 'Outstanding invoices bucketed by how long they are overdue, per client.',
  },
  {
    to: 'tax-summary',
    title: 'Tax summary',
    desc: 'Tax collected on invoices versus tax paid on expenses, by rate.',
  },
  {
    to: 'revenue-by-client',
    title: 'Revenue by client',
    desc: 'Who you invoiced, how much was paid and what is still outstanding.',
  },
  {
    to: 'time-utilisation',
    title: 'Time utilisation',
    desc: 'Billable share of logged hours per team member and its value.',
  },
];

export function ReportsIndexPage() {
  const { base } = useWorkspace();
  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Financial statements and operational summaries, printable as-is."
        crumbs={[{ label: 'Reports' }]}
      />
      <div className="report-cards">
        {REPORTS.map((r) => (
          <Link key={r.to} to={`${base}/reports/${r.to}`} className="report-card">
            <div className="report-card__title">{r.title}</div>
            <p className="report-card__desc">{r.desc}</p>
          </Link>
        ))}
      </div>
    </>
  );
}
