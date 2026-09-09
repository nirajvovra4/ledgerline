import { useNavigate, useParams } from 'react-router-dom';
import { useAccounts } from '../../api/accounts';
import { useCreateExpense, useExpense, useUpdateExpense } from '../../api/expenses';
import { useTaxRates } from '../../api/taxRates';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ExpenseForm } from './ExpenseForm';

export function ExpenseFormPage() {
  const { id } = useParams<{ id: string }>();
  const { base } = useWorkspace();
  const today = useToday();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useExpense(id);
  const accounts = useAccounts();
  const taxRates = useTaxRates();
  const create = useCreateExpense();
  const update = useUpdateExpense(id ?? '');
  const editing = Boolean(id);

  if ((editing && existing.isLoading) || accounts.isLoading || taxRates.isLoading)
    return <SkeletonRows rows={8} />;
  const error = (editing && existing.error) || accounts.error || taxRates.error;
  if (error)
    return (
      <ErrorState
        error={error}
        onRetry={() =>
          void Promise.all([existing.refetch(), accounts.refetch(), taxRates.refetch()])
        }
      />
    );
  const expense = existing.data?.expense;

  return (
    <div className="content--narrow">
      <PageHeader
        title={editing ? `Edit expense` : 'New expense'}
        crumbs={[
          { label: 'Expenses', to: `${base}/expenses` },
          ...(expense ? [{ label: expense.vendor, to: `${base}/expenses/${expense.id}` }] : []),
          { label: editing ? 'Edit' : 'New' },
        ]}
      />
      <div className="paper">
        <div className="paper__body">
          <ExpenseForm
            key={expense?.id ?? 'new'}
            expense={expense}
            accounts={accounts.data?.items ?? []}
            taxRates={taxRates.data ?? []}
            today={today}
            submitLabel={editing ? 'Save changes' : 'Create expense'}
            onSubmit={async (data) => {
              if (editing && expense) {
                await update.mutateAsync(data);
                toast.success('Expense updated');
                navigate(`${base}/expenses/${expense.id}`);
              } else {
                const res = await create.mutateAsync(data);
                toast.success('Expense created');
                navigate(`${base}/expenses/${res.expense.id}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
