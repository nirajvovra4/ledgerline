import {
  APPROVAL_STATUSES,
  EXPENSE_STATUSES,
  INVOICE_STATUSES,
  PROJECT_STATUSES,
  labelFor,
  toneFor,
  type ApprovalStatus,
  type DerivedInvoiceStatus,
  type ExpenseStatus,
  type LabeledOption,
  type ProjectStatus,
  type Tone,
} from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface StatusStampProps {
  label: string;
  tone?: Tone;
  size?: 'sm' | 'lg';
  className?: string;
}

/** Outlined, uppercase, letter-spaced "rubber stamp" chip. */
export function StatusStamp({ label, tone = 'neutral', size = 'sm', className }: StatusStampProps) {
  return (
    <span
      className={cx('stamp', `stamp--${tone}`, size === 'lg' && 'stamp--lg', className)}
      data-tone={tone}
    >
      {label}
    </span>
  );
}

function fromOptions<T extends string>(options: LabeledOption<T>[], value: T, size?: 'sm' | 'lg') {
  return (
    <StatusStamp label={labelFor(options, value)} tone={toneFor(options, value)} size={size} />
  );
}

export const InvoiceStamp = ({
  status,
  size,
}: {
  status: DerivedInvoiceStatus;
  size?: 'sm' | 'lg';
}) => fromOptions(INVOICE_STATUSES, status, size);
export const ExpenseStamp = ({ status, size }: { status: ExpenseStatus; size?: 'sm' | 'lg' }) =>
  fromOptions(EXPENSE_STATUSES, status, size);
export const ProjectStamp = ({ status, size }: { status: ProjectStatus; size?: 'sm' | 'lg' }) =>
  fromOptions(PROJECT_STATUSES, status, size);
export const ApprovalStamp = ({ status, size }: { status: ApprovalStatus; size?: 'sm' | 'lg' }) =>
  fromOptions(APPROVAL_STATUSES, status, size);
export const ClientStamp = ({ status }: { status: 'active' | 'archived' }) => (
  <StatusStamp
    label={status === 'active' ? 'Active' : 'Archived'}
    tone={status === 'active' ? 'positive' : 'muted'}
  />
);
