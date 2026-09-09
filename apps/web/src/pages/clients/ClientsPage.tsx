import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pluralize, type ClientDto } from '@ledgerline/shared';
import { useClients } from '../../api/clients';
import { LinkButton } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { ClientStamp } from '../../components/StatusStamp';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useWorkspace } from '../../hooks/useWorkspace';

const DEFAULTS = { q: '', status: 'active', sort: 'name', dir: 'asc', page: 1, pageSize: 25 };

export function ClientsPage() {
  const { base, currency } = useWorkspace();
  const navigate = useNavigate();
  const canManage = usePermission('clients.manage');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const q = useDebounce(params.q, 250);
  const query = useClients({
    q: q || undefined,
    status: params.status as 'active' | 'archived' | 'all',
    sort: params.sort,
    dir: params.dir as 'asc' | 'desc',
    page: params.page,
    pageSize: params.pageSize,
  });

  useHotkeys(
    useMemo(
      () => ({ n: () => canManage && navigate(`${base}/clients/new`) }),
      [canManage, navigate, base],
    ),
  );

  const columns: Column<ClientDto>[] = [
    {
      key: 'name',
      header: 'Client',
      sortable: true,
      render: (c) => (
        <div>
          <div className="table__primary">{c.name}</div>
          {c.company && c.company !== c.name ? (
            <div className="table__secondary">{c.company}</div>
          ) : null}
        </div>
      ),
      csv: (c) => c.name,
    },
    {
      key: 'email',
      header: 'Email',
      render: (c) => c.email || <span className="muted">—</span>,
      csv: (c) => c.email,
    },
    {
      key: 'paymentTermsDays',
      header: 'Terms',
      sortable: true,
      align: 'right',
      render: (c) => `${c.paymentTermsDays}d`,
      csv: (c) => c.paymentTermsDays,
    },
    {
      key: 'projectCount',
      header: 'Projects',
      align: 'right',
      render: (c) => c.projectCount,
      csv: (c) => c.projectCount,
    },
    {
      key: 'invoiceCount',
      header: 'Invoices',
      align: 'right',
      render: (c) => c.invoiceCount,
      csv: (c) => c.invoiceCount,
    },
    {
      key: 'outstandingCents',
      header: 'Outstanding',
      money: true,
      sortable: true,
      render: (c) => <Money cents={c.outstandingCents} currency={currency} muteZero />,
      csv: (c) => c.outstandingCents / 100,
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => <ClientStamp status={c.status} />,
      csv: (c) => c.status,
    },
  ];

  const total = query.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="Clients"
        subtitle={query.data ? pluralize(total, 'client') : undefined}
        crumbs={[{ label: 'Clients' }]}
        primary={
          canManage ? (
            <LinkButton to={`${base}/clients/new`} variant="primary">
              New client
            </LinkButton>
          ) : undefined
        }
      />
      <div className="table-toolbar">
        <Input
          className="input--search"
          type="search"
          placeholder="Search clients…"
          aria-label="Search clients"
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
        <Select
          aria-label="Status filter"
          value={params.status}
          onChange={(e) => setParams({ status: e.target.value })}
          options={[
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' },
            { value: 'all', label: 'All statuses' },
          ]}
        />
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(c) => c.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={{ key: params.sort, dir: params.dir as 'asc' | 'desc' }}
        onSortChange={(s) => setParams({ sort: s.key, dir: s.dir })}
        onRowClick={(c) => navigate(`${base}/clients/${c.id}`)}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total,
          onPageChange: (page) => setParams({ page }),
          onPageSizeChange: (pageSize) => setParams({ pageSize, page: 1 }),
        }}
        empty={{
          title: params.q ? `No clients match “${params.q}”` : 'No clients yet',
          description: params.q
            ? 'Try a different search or clear the filter.'
            : 'Clients are the people and companies you invoice.',
          action:
            canManage && !params.q ? (
              <LinkButton to={`${base}/clients/new`}>Add a client</LinkButton>
            ) : undefined,
        }}
        exportName="clients"
        caption="Clients"
      />
    </>
  );
}
