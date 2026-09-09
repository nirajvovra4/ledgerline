import { useNavigate, useParams } from 'react-router-dom';
import { useClient, useCreateClient, useUpdateClient } from '../../api/clients';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ClientForm } from './ClientForm';

export function ClientFormPage() {
  const { id } = useParams<{ id: string }>();
  const { base } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useClient(id);
  const create = useCreateClient();
  const update = useUpdateClient(id ?? '');
  const editing = Boolean(id);

  if (editing && existing.isLoading) return <SkeletonRows rows={8} />;
  if (editing && existing.error)
    return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  const client = existing.data?.client;

  return (
    <div className="content--narrow">
      <PageHeader
        title={editing ? `Edit ${client?.name ?? 'client'}` : 'New client'}
        crumbs={[
          { label: 'Clients', to: `${base}/clients` },
          ...(client ? [{ label: client.name, to: `${base}/clients/${client.id}` }] : []),
          { label: editing ? 'Edit' : 'New' },
        ]}
      />
      <div className="paper">
        <div className="paper__body">
          <ClientForm
            key={client?.id ?? 'new'}
            client={client}
            submitLabel={editing ? 'Save changes' : 'Create client'}
            onSubmit={async (data) => {
              if (editing && client) {
                await update.mutateAsync(data);
                toast.success('Client updated');
                navigate(`${base}/clients/${client.id}`);
              } else {
                const res = await create.mutateAsync(data);
                toast.success('Client created');
                navigate(`${base}/clients/${res.client.id}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
