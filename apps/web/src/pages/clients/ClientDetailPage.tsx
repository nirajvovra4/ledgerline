import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  formatAddress,
  formatDate,
  minutesToDuration,
  pluralize,
  type ProjectDto,
} from '@ledgerline/shared';
import { useArchiveClient, useClient } from '../../api/clients';
import { Avatar } from '../../components/Avatar';
import { Button, LinkButton } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type Column } from '../../components/DataTable';
import { ErrorState } from '../../components/ErrorState';
import { KeyValue } from '../../components/KeyValue';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { SkeletonRows } from '../../components/Skeleton';
import { Stat } from '../../components/Stat';
import { ClientStamp, ProjectStamp } from '../../components/StatusStamp';
import { UrlTabs, useUrlTab } from '../../components/Tabs';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { INVOICE_STATUSES } from '@ledgerline/shared';
import { InvoiceTable } from '../invoices/InvoiceTable';
import { ClientStatement } from './ClientStatement';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'projects', label: 'Projects' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'statement', label: 'Statement' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

export function ClientDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const { base, currency, money } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const canManage = usePermission('clients.manage');
  const query = useClient(id);
  const archive = useArchiveClient();
  const [tab] = useUrlTab<TabKey>([...TABS], 'overview');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [invoiceStatus, setInvoiceStatus] = useState('all');

  if (query.isLoading) return <SkeletonRows rows={8} />;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (!query.data) return null;
  const { client, stats, projects, invoices } = query.data;
  const address = formatAddress(client);

  const projectColumns: Column<ProjectDto>[] = [
    {
      key: 'name',
      header: 'Project',
      render: (p) => (
        <span className="table__primary">
          {p.code ? `${p.code} · ` : ''}
          {p.name}
        </span>
      ),
    },
    { key: 'status', header: 'Status', render: (p) => <ProjectStamp status={p.status} /> },
    {
      key: 'billing',
      header: 'Billing',
      render: (p) =>
        p.billingType === 'hourly'
          ? `Hourly · ${money.fmt(p.hourlyRateCents)}/h`
          : `Fixed · ${money.fmt(p.budgetCents)}`,
    },
    {
      key: 'logged',
      header: 'Logged',
      align: 'right',
      render: (p) => minutesToDuration(p.loggedMinutes),
    },
    {
      key: 'unbilled',
      header: 'Unbilled',
      align: 'right',
      render: (p) => minutesToDuration(p.unbilledMinutes),
    },
    {
      key: 'invoiced',
      header: 'Invoiced',
      money: true,
      render: (p) => <Money cents={p.invoicedCents} currency={currency} muteZero />,
    },
  ];

  const filteredInvoices =
    invoiceStatus === 'all'
      ? invoices
      : invoices.filter((i) =>
          invoiceStatus === 'open'
            ? ['approved', 'sent', 'partially_paid', 'overdue'].includes(i.derivedStatus)
            : i.derivedStatus === invoiceStatus,
        );

  return (
    <>
      <PageHeader
        title={client.name}
        titleNode={
          <span className="row" style={{ gap: 12 }}>
            <Avatar name={client.name} size="lg" square />
            {client.name}
          </span>
        }
        meta={<ClientStamp status={client.status} />}
        subtitle={client.company && client.company !== client.name ? client.company : undefined}
        crumbs={[{ label: 'Clients', to: `${base}/clients` }, { label: client.name }]}
        actions={
          canManage ? (
            <>
              <LinkButton to={`${base}/clients/${client.id}/edit`}>Edit</LinkButton>
              {client.status === 'active' ? (
                <Button variant="danger" onClick={() => setConfirmArchive(true)}>
                  Archive
                </Button>
              ) : null}
            </>
          ) : undefined
        }
        primary={
          <LinkButton to={`${base}/invoices/new?clientId=${client.id}`} variant="primary">
            New invoice
          </LinkButton>
        }
      />
      <UrlTabs items={[...TABS]} defaultKey="overview" ariaLabel="Client sections" />

      {tab === 'overview' ? (
        <div className="stack stack--lg">
          <div className="stat-strip">
            <Stat
              label="Invoiced"
              value={money.fmt(stats.invoicedCents)}
              sub={pluralize(stats.invoiceCount, 'invoice')}
              size="sm"
            />
            <Stat label="Paid" value={money.fmt(stats.paidCents)} size="sm" tone="positive" />
            <Stat label="Outstanding" value={money.fmt(stats.outstandingCents)} size="sm" />
            <Stat
              label="Overdue"
              value={money.fmt(stats.overdueCents)}
              size="sm"
              tone={stats.overdueCents > 0 ? 'negative' : undefined}
            />
            <Stat
              label="Avg. days to pay"
              value={stats.averageDaysToPay == null ? '—' : String(stats.averageDaysToPay)}
              size="sm"
            />
            <Stat
              label="Unbilled time"
              value={minutesToDuration(stats.unbilledMinutes)}
              sub={money.fmt(stats.unbilledCents)}
              size="sm"
            />
          </div>
          <div className="contact-card">
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Contact</h2>
              </div>
              <div className="paper__body">
                <KeyValue
                  items={[
                    {
                      key: 'email',
                      label: 'Email',
                      value: client.email ? (
                        <a href={`mailto:${client.email}`}>{client.email}</a>
                      ) : null,
                    },
                    { key: 'phone', label: 'Phone', value: client.phone || null },
                    { key: 'company', label: 'Company', value: client.company || null },
                    { key: 'taxId', label: 'Tax ID', value: client.taxId || null },
                    {
                      key: 'since',
                      label: 'Client since',
                      value: formatDate(client.createdAt.slice(0, 10)),
                    },
                  ]}
                />
              </div>
            </section>
            <section className="paper">
              <div className="paper__head">
                <h2 className="paper__title">Address & terms</h2>
              </div>
              <div className="paper__body stack">
                {address.length > 0 ? (
                  <div className="address-block">{address.join('\n')}</div>
                ) : (
                  <span className="muted small">No address on file.</span>
                )}
                <KeyValue
                  items={[
                    {
                      key: 'terms',
                      label: 'Payment terms',
                      value: `${client.paymentTermsDays} days`,
                    },
                  ]}
                />
                {client.notes ? (
                  <p className="small soft" style={{ whiteSpace: 'pre-line' }}>
                    {client.notes}
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {tab === 'projects' ? (
        <DataTable
          columns={projectColumns}
          rows={projects}
          rowKey={(p) => p.id}
          onRowClick={(p) => navigate(`${base}/projects/${p.id}`)}
          empty={{
            title: 'No projects',
            description: 'Projects group time and invoices for this client.',
            action: (
              <LinkButton to={`${base}/projects/new?clientId=${client.id}`}>New project</LinkButton>
            ),
          }}
          exportName={`${client.name}-projects`}
        />
      ) : null}

      {tab === 'invoices' ? (
        <div className="stack">
          <div className="table-toolbar">
            <Select
              aria-label="Invoice status"
              value={invoiceStatus}
              onChange={(e) => setInvoiceStatus(e.target.value)}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'open', label: 'Open' },
                ...INVOICE_STATUSES.map((s) => ({ value: s.value, label: s.label })),
              ]}
            />
          </div>
          <InvoiceTable
            rows={filteredInvoices}
            showClient={false}
            emptyTitle="No invoices for this client"
            exportName={`${client.name}-invoices`}
          />
        </div>
      ) : null}

      {tab === 'statement' ? <ClientStatement clientId={client.id} /> : null}

      <ConfirmDialog
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this client?"
        message="Archived clients are hidden from lists and pickers. Their invoices and history are kept."
        confirmLabel="Archive"
        variant="danger"
        onConfirm={async () => {
          await archive.mutateAsync(client.id);
          toast.success('Client archived');
        }}
      />
    </>
  );
}
