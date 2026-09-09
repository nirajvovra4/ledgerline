import {
  PAYMENT_METHODS,
  recordPaymentSchema,
  type InvoiceDetailDto,
  type PaymentMethod,
} from '@ledgerline/shared';
import { useRecordPayment } from '../../api/invoices';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Drawer } from '../../components/Drawer';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { MoneyInput } from '../../components/MoneyInput';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';

interface Values {
  date: string;
  amountCents: number | null;
  method: PaymentMethod;
  reference: string;
  note: string;
}

export function RecordPaymentDrawer({
  invoice,
  open,
  onClose,
}: {
  invoice: InvoiceDetailDto;
  open: boolean;
  onClose: () => void;
}) {
  const today = useToday();
  const { currency, money } = useWorkspace();
  const record = useRecordPayment();
  const toast = useToast();
  const form = useForm<Values, typeof recordPaymentSchema>({
    schema: recordPaymentSchema,
    initial: {
      date: today,
      amountCents: invoice.balanceCents,
      method: 'bank_transfer',
      reference: '',
      note: '',
    },
    transform: (v) => ({ ...v, amountCents: v.amountCents ?? undefined }),
    onSubmit: async (data) => {
      await record.mutateAsync({ id: invoice.id, ...data });
      toast.success('Payment recorded', money.fmt(data.amountCents));
      onClose();
    },
  });
  const over = (form.values.amountCents ?? 0) > invoice.balanceCents;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Record payment · ${invoice.number}`}
      locked={form.submitting}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={form.submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => form.handleSubmit()} loading={form.submitting}>
            Record payment
          </Button>
        </>
      }
    >
      <Form onSubmit={form.handleSubmit}>
        <FormError message={form.submitError} />
        <p className="small soft">
          Balance due: <strong>{money.fmt(invoice.balanceCents)}</strong> of{' '}
          {money.fmt(invoice.totalCents)}.
        </p>
        <Field
          label="Amount"
          error={form.errors.amountCents}
          required
          hint={over ? 'This is more than the balance due.' : undefined}
        >
          <MoneyInput
            currency={currency}
            value={form.values.amountCents}
            onChange={(v) => form.setValue('amountCents', v)}
            allowNegative={false}
            data-autofocus
          />
        </Field>
        <Field label="Date" error={form.errors.date} required>
          <DateInput value={form.values.date} onChange={(v) => form.setValue('date', v)} />
        </Field>
        <Field label="Method" error={form.errors.method} required>
          <Select
            value={form.values.method}
            onChange={(e) => form.setValue('method', e.target.value as PaymentMethod)}
            options={PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label }))}
          />
        </Field>
        <Field
          label="Reference"
          error={form.errors.reference}
          hint="Bank reference, cheque number…"
        >
          <Input
            value={form.values.reference}
            onChange={(e) => form.setValue('reference', e.target.value)}
          />
        </Field>
        <Field label="Note" error={form.errors.note}>
          <Textarea
            value={form.values.note}
            onChange={(e) => form.setValue('note', e.target.value)}
            rows={2}
          />
        </Field>
      </Form>
    </Drawer>
  );
}
