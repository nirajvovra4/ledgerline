import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDate, humanize, pluralize, type JournalEntryDto } from '@ledgerline/shared';
import { useAccounts } from '../../api/accounts';
import { useJournal } from '../../api/journal';
import { Button } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { DateRangePicker } from '../../components/DateRangePicker';
import { IconPlus } from '../../components/Icons';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { accountGroups } from '../expenses/ExpenseForm';
import { ManualEntryDrawer } from './ManualEntryDrawer';

const DEFAULTS = { from: '', to: '', accountId: '', sourceType: '', q: '', page: 1, pageSize: 25 };
const SOURCE_TYPES = ['invoice', 'payment', 'expense', 'expense_payment', 'manual', 'reversal'];

export function JournalPage() {
  const { base, currency, settings } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const canPost = usePermission('ledger.post');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const q = useDebounce(params.q, 250);
  const accounts = useAccounts(true);
  const query = useJournal({
    from: params.from || undefined,
    to: params.to || undefined,
    accountId: params.accountId || undefined,
    sourceType: params.sourceType || undefined,
    q: q || undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const [drawer, setDrawer] = useState(false);
  useHotkeys(useMemo(() => ({ n: () => canPost && setDrawer(true) }), [canPost]));
  const groups = useMemo(() => accountGroups(accounts.data?.items ?? []), [accounts.data]);
  const range = params.from && params.to ? { from: params.from, to: params.to } : null;

  const columns: Column<JournalEntryDto>[] = [
    {
      key: 'entryNumber',
      header: '#',
      render: (e) => <span className="mono">{e.entryNumber}</span>,
      csv: (e) => e.entryNumber,
    },
    { key: 'date', header: 'Date', render: (e) => formatDate(e.date), csv: (e) => e.date },
    {
      key: 'memo',
      header: 'Memo',
      wrap: true,
      render: (e) => <span className="table__primary">{e.memo}</span>,
      csv: (e) => e.memo,
    },
    {
      key: 'source',
      header: 'Source',
      render: (e) => <span className="muted">{humanize(e.sourceType)}</span>,
      csv: (e) => e.sourceType,
    },
    {
      key: 'lines',
      header: 'Lines',
      align: 'right',
      render: (e) => e.lines.length,
      csv: (e) => e.lines.length,
    },
    {
      key: 'debit',
      header: 'Debit',
      money: true,
      render: (e) => <Money cents={e.totalDebitCents} currency={currency} />,
      csv: (e) => e.totalDebitCents / 100,
    },
    {
      key: 'credit',
      header: 'Credit',
      money: true,
      render: (e) => <Money cents={e.totalCreditCents} currency={currency} />,
      csv: (e) => e.totalCreditCents / 100,
    },
    { key: 'by', header: 'Posted by', render: (e) => e.postedByName, csv: (e) => e.postedByName },
  ];

  return (
    <>
      <PageHeader
        title="Journal"
        subtitle={query.data ? pluralize(query.data.total, 'entry', 'entries') : undefined}
        crumbs={[{ label: 'Books' }, { label: 'Journal' }]}
        primary={
          canPost ? (
            <Button variant="primary" icon={<IconPlus />} onClick={() => setDrawer(true)}>
              New manual entry
            </Button>
          ) : undefined
        }
      />
      <div className="table-toolbar">
        <Input
          className="input--search"
          type="search"
          placeholder="Search memo…"
          aria-label="Search journal"
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
        <Select
          aria-label="Account"
          value={params.accountId}
          onChange={(e) => setParams({ accountId: e.target.value })}
          placeholder="All accounts"
          groups={groups}
        />
        <Select
          aria-label="Source"
          value={params.sourceType}
          onChange={(e) => setParams({ sourceType: e.target.value })}
          placeholder="All sources"
          options={SOURCE_TYPES.map((s) => ({ value: s, label: humanize(s) }))}
        />
        {range ? (
          <>
            <DateRangePicker
              value={range}
              onChange={(r) => setParams({ from: r.from, to: r.to })}
              today={today}
              fiscalYearStartMonth={settings.fiscalYearStartMonth}
              size="sm"
            />
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => setParams({ from: '', to: '' })}
            >
              Clear dates
            </button>
          </>
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setParams({ from: today.slice(0, 8) + '01', to: today })}
          >
            Filter by date
          </button>
        )}
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(e) => e.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        onRowClick={(e) => navigate(`${base}/ledger/journal/${e.id}`)}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setParams({ page }),
        }}
        empty={{
          title: 'No journal entries',
          description:
            'Entries are posted automatically when invoices and expenses are approved and paid.',
        }}
        exportName="journal"
        caption="Journal entries"
      />
      {drawer ? (
        <ManualEntryDrawer
          open
          onClose={() => setDrawer(false)}
          accounts={accounts.data?.items ?? []}
          today={today}
        />
      ) : null}
    </>
  );
}
