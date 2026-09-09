import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ACCOUNT_TYPES,
  expenseInputSchema,
  formatBp,
  taxForLine,
  type AccountDto,
  type ExpenseDto,
  type ExpenseInput,
  type TaxRateDto,
} from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { useProjectOptions } from '../../api/projects';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { Money } from '../../components/Money';
import { MoneyInput } from '../../components/MoneyInput';
import { Select, type SelectGroup } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useWorkspace } from '../../hooks/useWorkspace';
import { taxRateLabel } from '../../lib/labels';

interface Values {
  vendor: string;
  description: string;
  date: string;
  dueDate: string;
  accountId: string;
  amountCents: number | null;
  taxRateId: string;
  clientId: string;
  projectId: string;
  billable: boolean;
  reference: string;
  notes: string;
}

export function accountGroups(
  accounts: AccountDto[],
  onlyType?: AccountDto['type'],
): SelectGroup[] {
  return ACCOUNT_TYPES.filter((t) => !onlyType || t.value === onlyType)
    .map((t) => ({
      label: t.label,
      options: accounts
        .filter((a) => a.type === t.value && !a.archived)
        .sort((a, b) => a.code.localeCompare(b.code))
        .map((a) => ({ value: a.id, label: `${a.code} ${a.name}` })),
    }))
    .filter((g) => g.options.length > 0);
}

export function ExpenseForm({
  expense,
  accounts,
  taxRates,
  today,
  onSubmit,
  submitLabel,
}: {
  expense?: ExpenseDto;
  accounts: AccountDto[];
  taxRates: TaxRateDto[];
  today: string;
  onSubmit: (data: ExpenseInput) => Promise<void>;
  submitLabel: string;
}) {
  const { base, currency, settings } = useWorkspace();
  const navigate = useNavigate();
  const clients = useClientOptions();
  const form = useForm<Values, typeof expenseInputSchema>({
    schema: expenseInputSchema,
    initial: {
      vendor: expense?.vendor ?? '',
      description: expense?.description ?? '',
      date: expense?.date ?? today,
      dueDate: expense?.dueDate ?? '',
      accountId: expense?.accountId ?? '',
      amountCents: expense?.amountCents ?? null,
      taxRateId: expense?.taxRateId ?? settings.defaultTaxRateId ?? '',
      clientId: expense?.clientId ?? '',
      projectId: expense?.projectId ?? '',
      billable: expense?.billable ?? false,
      reference: expense?.reference ?? '',
      notes: expense?.notes ?? '',
    },
    transform: (v) => ({
      ...v,
      amountCents: v.amountCents ?? undefined,
      taxRateId: v.taxRateId || null,
      clientId: v.clientId || null,
      projectId: v.projectId || null,
      dueDate: v.dueDate || null,
    }),
    onSubmit,
  });
  const projects = useProjectOptions(form.values.clientId || undefined);
  const groups = useMemo(() => accountGroups(accounts, 'expense'), [accounts]);
  const rateBp = taxRates.find((t) => t.id === form.values.taxRateId)?.rateBp ?? 0;
  const net = form.values.amountCents ?? 0;
  const tax = taxForLine(net, rateBp);

  return (
    <Form onSubmit={form.handleSubmit} aria-label={expense ? 'Edit expense' : 'New expense'}>
      <FormError message={form.submitError} />
      <FormSection title="Expense">
        <FormGrid>
          <Field label="Vendor" error={form.errors.vendor} required>
            <Input
              value={form.values.vendor}
              onChange={(e) => form.setValue('vendor', e.target.value)}
              autoFocus
              placeholder="Figma, Inc."
            />
          </Field>
          <Field label="Description" error={form.errors.description} required>
            <Input
              value={form.values.description}
              onChange={(e) => form.setValue('description', e.target.value)}
              placeholder="Annual team licence"
            />
          </Field>
          <Field label="Date" error={form.errors.date} required>
            <DateInput value={form.values.date} onChange={(v) => form.setValue('date', v)} />
          </Field>
          <Field
            label="Due date"
            error={form.errors.dueDate}
            hint="When the vendor expects payment."
          >
            <DateInput value={form.values.dueDate} onChange={(v) => form.setValue('dueDate', v)} />
          </Field>
          <Field label="Account" error={form.errors.accountId} required>
            <Select
              value={form.values.accountId}
              onChange={(e) => form.setValue('accountId', e.target.value)}
              placeholder="Choose an expense account"
              groups={groups}
            />
          </Field>
          <Field label="Reference" error={form.errors.reference} hint="Receipt or invoice number.">
            <Input
              value={form.values.reference}
              onChange={(e) => form.setValue('reference', e.target.value)}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Amount">
        <FormGrid>
          <Field label="Net amount" error={form.errors.amountCents} required>
            <MoneyInput
              currency={currency}
              value={form.values.amountCents}
              onChange={(v) => form.setValue('amountCents', v)}
              allowNegative={false}
            />
          </Field>
          <Field label="Tax rate" error={form.errors.taxRateId}>
            <Select
              value={form.values.taxRateId}
              onChange={(e) => form.setValue('taxRateId', e.target.value)}
              placeholder="No tax"
              options={taxRates
                .filter((t) => !t.archived)
                .map((t) => ({ value: t.id, label: taxRateLabel(t) }))}
            />
          </Field>
        </FormGrid>
        <div className="totals-panel" style={{ maxWidth: 320 }} data-testid="expense-total">
          <div className="totals-panel__row">
            <span>Net</span>
            <Money cents={net} currency={currency} />
          </div>
          <div className="totals-panel__row">
            <span>Tax {rateBp ? `(${formatBp(rateBp)})` : ''}</span>
            <Money cents={tax} currency={currency} />
          </div>
          <div className="totals-panel__row totals-panel__row--total">
            <span>Total</span>
            <Money cents={net + tax} currency={currency} />
          </div>
        </div>
      </FormSection>
      <FormSection
        title="Client & billing"
        description="Link the expense to a client to rebill it later."
      >
        <FormGrid>
          <Field label="Client" error={form.errors.clientId}>
            <Select
              value={form.values.clientId}
              onChange={(e) => form.setValues({ clientId: e.target.value, projectId: '' })}
              placeholder="No client"
              options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Project" error={form.errors.projectId}>
            <Select
              value={form.values.projectId}
              onChange={(e) => form.setValue('projectId', e.target.value)}
              placeholder="No project"
              disabled={!form.values.clientId}
              options={(projects.data?.items ?? []).map((p) => ({ value: p.id, label: p.name }))}
            />
          </Field>
          <Field label="Billable to client" inline error={form.errors.billable}>
            <Switch checked={form.values.billable} onChange={(v) => form.setValue('billable', v)} />
          </Field>
          <Field label="Notes" error={form.errors.notes} className="span-2">
            <Textarea
              value={form.values.notes}
              onChange={(e) => form.setValue('notes', e.target.value)}
              rows={3}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button
          variant="ghost"
          onClick={() => navigate(expense ? `${base}/expenses/${expense.id}` : `${base}/expenses`)}
        >
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={form.submitting}>
          {submitLabel}
        </Button>
      </FormActions>
    </Form>
  );
}
