import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { INVOICE_STATUSES, pluralize, type DateRange } from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { useInvoices } from '../../api/invoices';
import { LinkButton } from '../../components/Button';
import { DateRangePicker } from '../../components/DateRangePicker';
import { Input } from '../../components/Input';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { Stat } from '../../components/Stat';
import { Tabs } from '../../components/Tabs';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { InvoiceTable } from './InvoiceTable';

const DEFAULTS = {
  status: 'all',
  q: '',
  clientId: '',
  from: '',
  to: '',
  sort: 'issueDate',
  dir: 'desc',
  page: 1,
  pageSize: 25,
};
const TAB_KEYS = [
  'all',
  'open',
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'overdue',
  'partially_paid',
  'paid',
  'void',
] as const;

export function InvoicesPage() {
  const { base, money, settings } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const canCreate = usePermission('invoices.create');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const q = useDebounce(params.q, 250);
  const clients = useClientOptions();
  const query = useInvoices({
    status: params.status,
    q: q || undefined,
    clientId: params.clientId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    sort: params.sort,
    dir: params.dir as 'asc' | 'desc',
    page: params.page,
    pageSize: params.pageSize,
  });
  // Unfiltered summary (all statuses, same client/date filters) for the tab counts.
  const counts = useInvoices({
    status: 'all',
    clientId: params.clientId || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    pageSize: 1,
  });
  useHotkeys(
    useMemo(
      () => ({ n: () => canCreate && navigate(`${base}/invoices/new`) }),
      [canCreate, navigate, base],
    ),
  );

  const tabs = TAB_KEYS.map((key) => ({
    key,
    label:
      key === 'all'
        ? 'All'
        : key === 'open'
          ? 'Open'
          : (INVOICE_STATUSES.find((s) => s.value === key)?.label ?? key),
    count: key === 'all' ? counts.data?.summary.count : counts.data?.counts?.[key],
  }));
  const summary = query.data?.summary;
  const range: DateRange | null =
    params.from && params.to ? { from: params.from, to: params.to } : null;

  return (
    <>
      <PageHeader
        title="Invoices"
        subtitle={summary ? pluralize(summary.count, 'invoice') : undefined}
        crumbs={[{ label: 'Invoices' }]}
        actions={
          canCreate ? (
            <LinkButton to={`${base}/invoices/from-time`}>From time</LinkButton>
          ) : undefined
        }
        primary={
          canCreate ? (
            <LinkButton to={`${base}/invoices/new`} variant="primary">
              New invoice
            </LinkButton>
          ) : undefined
        }
      />
      {summary ? (
        <div className="stat-strip" style={{ marginBottom: 20 }}>
          <Stat label="Invoices" value={String(summary.count)} size="sm" />
          <Stat label="Total" value={money.fmt(summary.totalCents)} size="sm" />
          <Stat label="Outstanding" value={money.fmt(summary.outstandingCents)} size="sm" />
          <Stat
            label="Overdue"
            value={money.fmt(summary.overdueCents)}
            size="sm"
            tone={summary.overdueCents > 0 ? 'negative' : undefined}
          />
        </div>
      ) : null}
      <Tabs
        items={tabs}
        value={(TAB_KEYS as readonly string[]).includes(params.status) ? params.status : 'all'}
        onChange={(status) => setParams({ status })}
        ariaLabel="Invoice status"
      />
      <div className="table-toolbar">
        <Input
          className="input--search"
          type="search"
          placeholder="Search number, client…"
          aria-label="Search invoices"
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
        <Select
          aria-label="Client filter"
          value={params.clientId}
          onChange={(e) => setParams({ clientId: e.target.value })}
          placeholder="All clients"
          options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        {range ? (
          <DateRangePicker
            value={range}
            onChange={(r) => setParams({ from: r.from, to: r.to })}
            today={today}
            fiscalYearStartMonth={settings.fiscalYearStartMonth}
            size="sm"
          />
        ) : (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setParams({ from: today.slice(0, 8) + '01', to: today })}
          >
            Filter by date
          </button>
        )}
        {range ? (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setParams({ from: '', to: '' })}
          >
            Clear dates
          </button>
        ) : null}
      </div>
      <InvoiceTable
        rows={query.data?.items}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={{ key: params.sort, dir: params.dir as 'asc' | 'desc' }}
        onSortChange={(s) => setParams({ sort: s.key, dir: s.dir })}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setParams({ page }),
          onPageSizeChange: (pageSize) => setParams({ pageSize, page: 1 }),
        }}
        emptyTitle={
          params.status === 'all' && !params.q
            ? 'No invoices yet'
            : 'No invoices match these filters'
        }
        emptyDescription={
          params.status === 'all' && !params.q
            ? 'Create an invoice from scratch or from unbilled time.'
            : 'Try another status or clear the search.'
        }
        emptyAction={
          canCreate && params.status === 'all' && !params.q ? (
            <LinkButton to={`${base}/invoices/new`}>New invoice</LinkButton>
          ) : undefined
        }
        exportName="invoices"
      />
    </>
  );
}
