import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { EXPENSE_STATUSES, formatDate, pluralize, type ExpenseDto } from '@ledgerline/shared';
import { useAccounts } from '../../api/accounts';
import { useClientOptions } from '../../api/clients';
import { useExpenses } from '../../api/expenses';
import { LinkButton } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { Stat } from '../../components/Stat';
import { ExpenseStamp } from '../../components/StatusStamp';
import { Tabs } from '../../components/Tabs';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useWorkspace } from '../../hooks/useWorkspace';
import { accountGroups } from './ExpenseForm';

const DEFAULTS = {
  status: 'all',
  q: '',
  accountId: '',
  clientId: '',
  sort: 'date',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};
const TAB_KEYS = [
  'all',
  'draft',
  'pending_approval',
  'approved',
  'unpaid',
  'paid',
  'rejected',
] as const;

export function ExpensesPage() {
  const { base, currency, money } = useWorkspace();
  const navigate = useNavigate();
  const canCreate = usePermission('expenses.create');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const q = useDebounce(params.q, 250);
  const accounts = useAccounts();
  const clients = useClientOptions();
  const query = useExpenses({
    status: params.status,
    q: q || undefined,
    accountId: params.accountId || undefined,
    clientId: params.clientId || undefined,
    sort: params.sort,
    dir: params.dir as 'asc' | 'desc',
    page: params.page,
    pageSize: params.pageSize,
  });
  const counts = useExpenses({
    status: 'all',
    accountId: params.accountId || undefined,
    clientId: params.clientId || undefined,
    pageSize: 1,
  });
  useHotkeys(
    useMemo(
      () => ({ n: () => canCreate && navigate(`${base}/expenses/new`) }),
      [canCreate, navigate, base],
    ),
  );
  const groups = useMemo(
    () => accountGroups(accounts.data?.items ?? [], 'expense'),
    [accounts.data],
  );

  const tabs = TAB_KEYS.map((key) => ({
    key,
    label:
      key === 'all'
        ? 'All'
        : key === 'unpaid'
          ? 'Unpaid'
          : (EXPENSE_STATUSES.find((s) => s.value === key)?.label ?? key),
    count: key === 'all' ? counts.data?.summary.count : counts.data?.counts?.[key],
  }));

  const columns: Column<ExpenseDto>[] = [
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (e) => formatDate(e.date),
      csv: (e) => e.date,
    },
    {
      key: 'vendor',
      header: 'Vendor',
      sortable: true,
      render: (e) => (
        <div>
          <div className="table__primary">{e.vendor}</div>
          <div className="table__secondary truncate" style={{ maxWidth: 280 }}>
            {e.description}
          </div>
        </div>
      ),
      csv: (e) => e.vendor,
    },
    { key: 'account', header: 'Account', render: (e) => e.accountName, csv: (e) => e.accountName },
    {
      key: 'client',
      header: 'Client',
      render: (e) => e.clientName ?? <span className="muted">—</span>,
      csv: (e) => e.clientName ?? '',
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (e) => <ExpenseStamp status={e.status} />,
      csv: (e) => e.status,
    },
    {
      key: 'total',
      header: 'Total',
      money: true,
      sortable: true,
      render: (e) => <Money cents={e.totalCents} currency={currency} />,
      csv: (e) => e.totalCents / 100,
    },
  ];
  const summary = query.data?.summary;

  return (
    <>
      <PageHeader
        title="Expenses"
        subtitle={summary ? pluralize(summary.count, 'expense') : undefined}
        crumbs={[{ label: 'Expenses' }]}
        primary={
          canCreate ? (
            <LinkButton to={`${base}/expenses/new`} variant="primary">
              New expense
            </LinkButton>
          ) : undefined
        }
      />
      {summary ? (
        <div className="stat-strip" style={{ marginBottom: 20 }}>
          <Stat label="Expenses" value={String(summary.count)} size="sm" />
          <Stat label="Total" value={money.fmt(summary.totalCents)} size="sm" />
          <Stat
            label="Unpaid"
            value={money.fmt(summary.unpaidCents)}
            size="sm"
            tone={summary.unpaidCents > 0 ? 'warning' : undefined}
          />
          <Stat label="Pending approval" value={money.fmt(summary.pendingCents)} size="sm" />
        </div>
      ) : null}
      <Tabs
        items={tabs}
        value={(TAB_KEYS as readonly string[]).includes(params.status) ? params.status : 'all'}
        onChange={(status) => setParams({ status })}
        ariaLabel="Expense status"
      />
      <div className="table-toolbar">
        <Input
          className="input--search"
          type="search"
          placeholder="Search vendor, description…"
          aria-label="Search expenses"
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
          aria-label="Client"
          value={params.clientId}
          onChange={(e) => setParams({ clientId: e.target.value })}
          placeholder="All clients"
          options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(e) => e.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={{ key: params.sort, dir: params.dir as 'asc' | 'desc' }}
        onSortChange={(s) => setParams({ sort: s.key, dir: s.dir })}
        onRowClick={(e) => navigate(`${base}/expenses/${e.id}`)}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setParams({ page }),
        }}
        empty={{
          title: 'No expenses',
          description: 'Record vendor bills and receipts here; approved ones post to the ledger.',
          action: canCreate ? (
            <LinkButton to={`${base}/expenses/new`}>New expense</LinkButton>
          ) : undefined,
        }}
        exportName="expenses"
        caption="Expenses"
      />
    </>
  );
}
