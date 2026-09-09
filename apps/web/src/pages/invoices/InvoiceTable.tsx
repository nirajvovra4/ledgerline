import { useNavigate } from 'react-router-dom';
import { daysOverdue, formatDate, formatRelative, type InvoiceDto } from '@ledgerline/shared';
import { DataTable, type Column, type SortState } from '../../components/DataTable';
import { Money } from '../../components/Money';
import type { PaginationProps } from '../../components/Pagination';
import { InvoiceStamp } from '../../components/StatusStamp';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';

export interface InvoiceTableProps {
  rows: InvoiceDto[] | undefined;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  sort?: SortState;
  onSortChange?: (s: SortState) => void;
  pagination?: PaginationProps;
  showClient?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  exportName?: string;
}

export function DueCell({ invoice, today }: { invoice: InvoiceDto; today: string }) {
  const overdue = invoice.derivedStatus === 'overdue';
  const open = ['sent', 'partially_paid', 'approved'].includes(invoice.status);
  const days = daysOverdue(invoice.dueDate, today);
  return (
    <span>
      {formatDate(invoice.dueDate)}
      {overdue ? (
        <span className="tone-negative tiny" style={{ marginLeft: 6 }}>
          {days} {days === 1 ? 'day' : 'days'} overdue
        </span>
      ) : open ? (
        <span className="muted tiny" style={{ marginLeft: 6 }}>
          due {formatRelative(invoice.dueDate, today)}
        </span>
      ) : null}
    </span>
  );
}

export function InvoiceTable({
  rows,
  loading,
  error,
  onRetry,
  sort,
  onSortChange,
  pagination,
  showClient = true,
  emptyTitle,
  emptyDescription,
  emptyAction,
  exportName,
}: InvoiceTableProps) {
  const { base, currency } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const columns: Column<InvoiceDto>[] = [
    {
      key: 'number',
      header: 'Number',
      sortable: true,
      sortValue: (r) => r.number,
      render: (r) => <span className="table__primary">{r.number}</span>,
    },
    ...(showClient
      ? [
          {
            key: 'client',
            header: 'Client',
            sortable: true,
            sortValue: (r: InvoiceDto) => r.clientName,
            render: (r: InvoiceDto) => r.clientName,
          } satisfies Column<InvoiceDto>,
        ]
      : []),
    {
      key: 'issueDate',
      header: 'Issued',
      sortable: true,
      sortValue: (r) => r.issueDate,
      render: (r) => formatDate(r.issueDate),
      csv: (r) => r.issueDate,
    },
    {
      key: 'dueDate',
      header: 'Due',
      sortable: true,
      sortValue: (r) => r.dueDate,
      render: (r) => <DueCell invoice={r} today={today} />,
      csv: (r) => r.dueDate,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortValue: (r) => r.derivedStatus,
      render: (r) => <InvoiceStamp status={r.derivedStatus} />,
      csv: (r) => r.derivedStatus,
    },
    {
      key: 'total',
      header: 'Total',
      money: true,
      sortable: true,
      sortValue: (r) => r.totalCents,
      render: (r) => <Money cents={r.totalCents} currency={currency} />,
      csv: (r) => r.totalCents / 100,
    },
    {
      key: 'balance',
      header: 'Balance',
      money: true,
      sortable: true,
      sortValue: (r) => r.balanceCents,
      render: (r) => <Money cents={r.balanceCents} currency={currency} muteZero />,
      csv: (r) => r.balanceCents / 100,
    },
  ];
  return (
    <DataTable
      columns={columns}
      rows={rows}
      rowKey={(r) => r.id}
      loading={loading}
      error={error}
      onRetry={onRetry}
      sort={sort}
      onSortChange={onSortChange}
      pagination={pagination}
      onRowClick={(r) => navigate(`${base}/invoices/${r.id}`)}
      empty={{
        title: emptyTitle ?? 'No invoices',
        description: emptyDescription,
        action: emptyAction,
      }}
      exportName={exportName}
      caption="Invoices"
    />
  );
}
