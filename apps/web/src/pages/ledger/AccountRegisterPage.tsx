import { Link, useParams } from 'react-router-dom';
import { formatDate, humanize, type RegisterRow } from '@ledgerline/shared';
import { useAccountRegister } from '../../api/accounts';
import { DataTable, type Column } from '../../components/DataTable';
import { DateRangePicker } from '../../components/DateRangePicker';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Stat } from '../../components/Stat';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { rangeForPreset } from '../../lib/dates';

const DEFAULTS = { from: '', to: '', page: 1, pageSize: 50 };

export function AccountRegisterPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, currency, money, settings } = useWorkspace();
  const today = useToday();
  const [params, setParams] = useQueryParams(DEFAULTS);
  const fallback = rangeForPreset('fiscal_year', today, settings.fiscalYearStartMonth)!;
  const range = { from: params.from || fallback.from, to: params.to || fallback.to };
  const query = useAccountRegister(id, {
    from: range.from,
    to: range.to,
    page: params.page,
    pageSize: params.pageSize,
  });
  const account = query.data?.account;

  const columns: Column<RegisterRow>[] = [
    { key: 'date', header: 'Date', render: (r) => formatDate(r.date), csv: (r) => r.date },
    {
      key: 'entry',
      header: 'Entry',
      render: (r) => <Link to={`${base}/ledger/journal/${r.entryId}`}>#{r.entryNumber}</Link>,
      csv: (r) => r.entryNumber,
    },
    { key: 'memo', header: 'Memo', wrap: true, render: (r) => r.memo, csv: (r) => r.memo },
    {
      key: 'source',
      header: 'Source',
      render: (r) => <span className="muted">{humanize(r.sourceType)}</span>,
      csv: (r) => r.sourceType,
    },
    {
      key: 'debit',
      header: 'Debit',
      money: true,
      render: (r) => (r.debitCents ? <Money cents={r.debitCents} currency={currency} /> : null),
      csv: (r) => r.debitCents / 100,
    },
    {
      key: 'credit',
      header: 'Credit',
      money: true,
      render: (r) => (r.creditCents ? <Money cents={r.creditCents} currency={currency} /> : null),
      csv: (r) => r.creditCents / 100,
    },
    {
      key: 'balance',
      header: 'Balance',
      money: true,
      render: (r) => <Money cents={r.runningBalanceCents} currency={currency} />,
      csv: (r) => r.runningBalanceCents / 100,
    },
  ];

  return (
    <>
      <PageHeader
        title={account ? `${account.code} ${account.name}` : 'Account register'}
        subtitle={
          account?.description || (account ? `${humanize(account.type)} account` : undefined)
        }
        crumbs={[
          { label: 'Books' },
          { label: 'Chart of accounts', to: `${base}/ledger/accounts` },
          { label: account?.name ?? 'Register' },
        ]}
        actions={
          <DateRangePicker
            value={range}
            onChange={(r) => setParams({ from: r.from, to: r.to })}
            today={today}
            fiscalYearStartMonth={settings.fiscalYearStartMonth}
            size="sm"
          />
        }
      />
      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <Stat
          label="Opening balance"
          value={money.fmt(query.data?.openingBalanceCents ?? 0)}
          size="sm"
          sub={formatDate(range.from)}
        />
        <Stat
          label="Closing balance"
          value={money.fmt(query.data?.closingBalanceCents ?? 0)}
          size="sm"
          sub={formatDate(range.to)}
        />
        <Stat label="Entries" value={String(query.data?.total ?? 0)} size="sm" />
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(r) => `${r.entryId}-${r.debitCents}-${r.creditCents}`}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setParams({ page }),
        }}
        empty={{
          title: 'No movements in this period',
          description: 'Widen the date range to see earlier activity.',
        }}
        exportName={account ? `register-${account.code}` : 'register'}
        caption="Account register"
      />
    </>
  );
}
