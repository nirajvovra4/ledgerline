import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  minutesToDuration,
  pluralize,
  PROJECT_STATUSES,
  type ProjectDto,
} from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { useProjects } from '../../api/projects';
import { LinkButton } from '../../components/Button';
import { DataTable, type Column } from '../../components/DataTable';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { ProjectStamp } from '../../components/StatusStamp';
import { useDebounce } from '../../hooks/useDebounce';
import { useHotkeys } from '../../hooks/useHotkeys';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useWorkspace } from '../../hooks/useWorkspace';

const DEFAULTS = {
  q: '',
  status: 'active',
  clientId: '',
  sort: 'name',
  dir: 'asc',
  page: 1,
  pageSize: 25,
};

export function ProjectsPage() {
  const { base, currency, money } = useWorkspace();
  const navigate = useNavigate();
  const canManage = usePermission('projects.manage');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const q = useDebounce(params.q, 250);
  const clients = useClientOptions();
  const query = useProjects({
    q: q || undefined,
    status: params.status as 'active' | 'all',
    clientId: params.clientId || undefined,
    sort: params.sort,
    dir: params.dir as 'asc' | 'desc',
    page: params.page,
    pageSize: params.pageSize,
  });
  useHotkeys(
    useMemo(
      () => ({ n: () => canManage && navigate(`${base}/projects/new`) }),
      [canManage, navigate, base],
    ),
  );

  const columns: Column<ProjectDto>[] = [
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      render: (p) => (
        <div>
          <div className="table__primary">{p.name}</div>
          {p.code ? <div className="table__secondary mono">{p.code}</div> : null}
        </div>
      ),
      csv: (p) => p.name,
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (p) => p.clientName,
      csv: (p) => p.clientName,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (p) => <ProjectStamp status={p.status} />,
      csv: (p) => p.status,
    },
    {
      key: 'billing',
      header: 'Billing',
      render: (p) =>
        p.billingType === 'hourly'
          ? `${money.fmt(p.hourlyRateCents)}/h`
          : `Fixed ${money.fmt(p.budgetCents)}`,
    },
    {
      key: 'logged',
      header: 'Logged',
      align: 'right',
      render: (p) => minutesToDuration(p.loggedMinutes),
      csv: (p) => p.loggedMinutes,
    },
    {
      key: 'unbilled',
      header: 'Unbilled',
      align: 'right',
      render: (p) =>
        p.unbilledMinutes > 0 ? (
          <span className="tone-warning">{minutesToDuration(p.unbilledMinutes)}</span>
        ) : (
          <span className="muted">0m</span>
        ),
      csv: (p) => p.unbilledMinutes,
    },
    {
      key: 'invoiced',
      header: 'Invoiced',
      money: true,
      sortable: true,
      render: (p) => <Money cents={p.invoicedCents} currency={currency} muteZero />,
      csv: (p) => p.invoicedCents / 100,
    },
  ];

  return (
    <>
      <PageHeader
        title="Projects"
        subtitle={query.data ? pluralize(query.data.total, 'project') : undefined}
        crumbs={[{ label: 'Projects' }]}
        primary={
          canManage ? (
            <LinkButton to={`${base}/projects/new`} variant="primary">
              New project
            </LinkButton>
          ) : undefined
        }
      />
      <div className="table-toolbar">
        <Input
          className="input--search"
          type="search"
          placeholder="Search projects…"
          aria-label="Search projects"
          value={params.q}
          onChange={(e) => setParams({ q: e.target.value })}
        />
        <Select
          aria-label="Status filter"
          value={params.status}
          onChange={(e) => setParams({ status: e.target.value })}
          options={[
            ...PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label })),
            { value: 'all', label: 'All statuses' },
          ]}
        />
        <Select
          aria-label="Client filter"
          value={params.clientId}
          onChange={(e) => setParams({ clientId: e.target.value })}
          placeholder="All clients"
          options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>
      <DataTable
        columns={columns}
        rows={query.data?.items}
        rowKey={(p) => p.id}
        loading={query.isLoading}
        error={query.error}
        onRetry={() => query.refetch()}
        sort={{ key: params.sort, dir: params.dir as 'asc' | 'desc' }}
        onSortChange={(s) => setParams({ sort: s.key, dir: s.dir })}
        onRowClick={(p) => navigate(`${base}/projects/${p.id}`)}
        pagination={{
          page: params.page,
          pageSize: params.pageSize,
          total: query.data?.total ?? 0,
          onPageChange: (page) => setParams({ page }),
        }}
        empty={{
          title: 'No projects found',
          description: 'Projects hold time entries and feed invoices.',
          action: canManage ? (
            <LinkButton to={`${base}/projects/new`}>New project</LinkButton>
          ) : undefined,
        }}
        exportName="projects"
        caption="Projects"
      />
    </>
  );
}
