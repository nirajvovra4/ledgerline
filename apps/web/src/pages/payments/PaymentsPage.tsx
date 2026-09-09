import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  formatDate,
  labelFor,
  PAYMENT_METHODS,
  pluralize,
  type PaymentDto,
} from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { useDeletePayment, usePayments } from '../../api/payments';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type Column } from '../../components/DataTable';
import { DateRangePicker } from '../../components/DateRangePicker';
import { IconTrash } from '../../components/Icons';
import { Money } from '../../components/Money';
import { PageHeader } from '../../components/PageHeader';
import { Select } from '../../components/Select';
import { Stat } from '../../components/Stat';
import { usePermission } from '../../hooks/usePermission';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';

const DEFAULTS = { clientId: '', method: '', from: '', to: '', page: 1, pageSize: 25 };

export function PaymentsPage() {
  const { base, currency, money, settings } = useWorkspace();
  const today = useToday();
  const toast = useToast();
  const canManage = usePermission('payments.manage');
  const [params, setParams] = useQueryParams(DEFAULTS);
  const clients = useClientOptions();
  const query = usePayments({
    clientId: params.clientId || undefined,
    method: params.method || undefined,
    from: params.from || undefined,
    to: params.to || undefined,
    page: params.page,
    pageSize: params.pageSize,
  });
  const remove = useDeletePayment();
  const [deleting, setDeleting] = useState<PaymentDto | null>(null);
  const range = params.from && params.to ? { from: params.from, to: params.to } : null;
  const pageTotal = (query.data?.items ?? []).reduce((s, p) => s + p.amountCents, 0);

  const columns: Column<PaymentDto>[] = [
    { key: 'date', header: 'Date', render: (p) => formatDate(p.date), csv: (p) => p.date },
    {
      key: 'invoice',
      header: 'Invoice',
      render: (p) => <Link to={`${base}/invoices/${p.invoiceId}`}>{p.invoiceNumber}</Link>,
      csv: (p) => p.invoiceNumber,
    },
    {
      key: 'client',
      header: 'Client',
      render: (p) => <Link to={`${base}/clients/${p.clientId}`}>{p.clientName}</Link>,
      csv: (p) => p.clientName,
    },
    {
      key: 'method',
      header: 'Method',
      render: (p) => labelFor(PAYMENT_METHODS, p.method),
      csv: (p) => p.method,
    },
    {
      key: 'reference',
      header: 'Reference',
      render: (p) => p.reference || <span className="muted">—</span>,
      csv: (p) => p.reference,
    },
    {
      key: 'amount',
      header: 'Amount',
      money: true,
      render: (p) => <Money cents={p.amountCents} currency={currency} />,
      csv: (p) => p.amountCents / 100,
    },
    ...(canManage
      ? [
          {
            key: 'actions',
            header: '',
            align: 'right' as const,
            render: (p: PaymentDto) => (
              <button
                type="button"
                className="icon-btn icon-btn--danger"
                aria-label={`Delete payment ${p.reference || p.invoiceNumber}`}
                onClick={() => setDeleting(p)}
              >
                <IconTrash />
              </button>
            ),
            csv: () => '',
          },
        ]
      : []),
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        subtitle={query.data ? pluralize(query.data.total, 'payment') : undefined}
        crumbs={[{ label: 'Payments' }]}
      />
      <div className="stat-strip" style={{ marginBottom: 20 }}>
        <Stat label="Payments" value={String(query.data?.total ?? 0)} size="sm" />
        <Stat label="On this page" value={money.fmt(pageTotal)} size="sm" />
      </div>
      <div className="table-toolbar">
        <Select
          aria-label="Client"
          value={params.clientId}
          onChange={(e) => setParams({ clientId: e.target.value })}
          placeholder="All clients"
          options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
        <Select
          aria-label="Method"
          value={params.method}
          onChange={(e) => setParams({ method: e.target.value })}
          placeholder="All methods"
          options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
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
        rowKey={(p) => p.id}
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
          title: 'No payments',
          description: 'Payments appear here when you record them against an invoice.',
        }}
        exportName="payments"
        caption="Payments"
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete this payment?"
        message={
          deleting
            ? `${money.fmt(deleting.amountCents)} against ${deleting.invoiceNumber} will be removed and its journal entry reversed.`
            : undefined
        }
        confirmLabel="Delete payment"
        variant="danger"
        onConfirm={async () => {
          if (!deleting) return;
          await remove.mutateAsync(deleting.id);
          toast.success('Payment deleted');
        }}
      />
    </>
  );
}
