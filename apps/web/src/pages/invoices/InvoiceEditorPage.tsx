import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAccounts } from '../../api/accounts';
import { useInvoice, useCreateInvoice, useUpdateInvoice } from '../../api/invoices';
import { useTaxRates } from '../../api/taxRates';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { InvoiceEditor } from './editor/InvoiceEditor';
import { initialValues, valuesFromInvoice } from './editor/editorState';

export function InvoiceEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const duplicateId = params.get('duplicate') ?? undefined;
  const sourceId = id ?? duplicateId;
  const { base, settings } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const source = useInvoice(sourceId);
  const taxRates = useTaxRates();
  const accounts = useAccounts();
  const create = useCreateInvoice();
  const update = useUpdateInvoice(id ?? '');
  const editing = Boolean(id);

  const loading = (sourceId && source.isLoading) || taxRates.isLoading || accounts.isLoading;
  if (loading) return <SkeletonRows rows={8} />;
  const error = (sourceId && source.error) || taxRates.error || accounts.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() => void Promise.all([source.refetch(), taxRates.refetch(), accounts.refetch()])}
      />
    );
  const existing = editing ? source.data : undefined;
  if (editing && existing && existing.status !== 'draft') {
    return (
      <ErrorState
        error={
          new Error(
            `Invoice ${existing.number} is ${existing.status.replace('_', ' ')} and can no longer be edited.`,
          )
        }
        title="Not editable"
      />
    );
  }

  const accountList = accounts.data?.items ?? [];
  const defaultAccount =
    accountList.find((a) => a.systemKey === 'services_revenue') ??
    accountList.find((a) => a.type === 'revenue');
  const rates = taxRates.data ?? [];
  const defaults = {
    accountId: defaultAccount?.id ?? '',
    taxRateId: settings.defaultTaxRateId ?? rates.find((r) => r.isDefault)?.id ?? null,
  };

  const initial = source.data
    ? valuesFromInvoice(source.data, editing ? 'edit' : 'duplicate', today)
    : initialValues({
        today,
        termsDays: settings.defaultPaymentTermsDays,
        defaults,
        clientId: params.get('clientId') ?? undefined,
        projectId: params.get('projectId') ?? undefined,
      });

  const title = editing
    ? `Edit ${existing?.number ?? 'invoice'}`
    : duplicateId
      ? `Duplicate of ${source.data?.number ?? 'invoice'}`
      : 'New invoice';

  return (
    <>
      <PageHeader
        title={title}
        crumbs={[
          { label: 'Invoices', to: `${base}/invoices` },
          ...(existing ? [{ label: existing.number, to: `${base}/invoices/${existing.id}` }] : []),
          { label: editing ? 'Edit' : 'New' },
        ]}
      />
      <InvoiceEditor
        key={sourceId ?? 'new'}
        initial={initial}
        existing={existing}
        taxRates={rates}
        accounts={accountList}
        defaults={defaults}
        submitLabel={editing ? 'Save changes' : 'Create draft'}
        onSubmit={async (input) => {
          if (editing && existing) {
            await update.mutateAsync(input);
            toast.success('Invoice updated');
            navigate(`${base}/invoices/${existing.id}`);
          } else {
            const res = await create.mutateAsync(input);
            toast.success(`Invoice ${res.invoice.number} created`);
            navigate(`${base}/invoices/${res.invoice.id}`);
          }
        }}
      />
    </>
  );
}
