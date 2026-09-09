import {
  PAYMENT_METHODS,
  payExpenseSchema,
  type ExpenseDto,
  type PaymentMethod,
} from '@ledgerline/shared';
import { usePayExpense } from '../../api/expenses';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Drawer } from '../../components/Drawer';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';

export function PayExpenseDrawer({
  expense,
  open,
  onClose,
}: {
  expense: ExpenseDto;
  open: boolean;
  onClose: () => void;
}) {
  const today = useToday();
  const { money } = useWorkspace();
  const pay = usePayExpense();
  const toast = useToast();
  const form = useForm<
    { date: string; method: PaymentMethod; reference: string },
    typeof payExpenseSchema
  >({
    schema: payExpenseSchema,
    initial: { date: today, method: 'bank_transfer', reference: expense.reference },
    onSubmit: async (data) => {
      await pay.mutateAsync({ id: expense.id, ...data });
      toast.success('Expense paid', money.fmt(expense.totalCents));
      onClose();
    },
  });
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Pay ${expense.vendor}`}
      locked={form.submitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => form.handleSubmit()} loading={form.submitting}>
            Mark as paid
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit}>
        <FormError message={form.submitError} />
        <p className="small soft">
          Pays <strong>{money.fmt(expense.totalCents)}</strong> from the operating bank account and
          clears accounts payable.
        </p>
        <Field label="Payment date" error={form.errors.date} required>
          <DateInput
            value={form.values.date}
            onChange={(v) => form.setValue('date', v)}
            data-autofocus
          />
        </Field>
        <Field label="Method" error={form.errors.method} required>
          <Select
            value={form.values.method}
            onChange={(e) => form.setValue('method', e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
          />
        </Field>
        <Field label="Reference" error={form.errors.reference}>
          <Input
            value={form.values.reference}
            onChange={(e) => form.setValue('reference', e.target.value)}
          />
        </Field>
      </Form>
    </Drawer>
  );
}
