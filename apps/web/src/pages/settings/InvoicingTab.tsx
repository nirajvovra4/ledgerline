import { previewInvoiceNumbers, updateWorkspaceSchema } from '@ledgerline/shared';
import { taxRateLabel } from '../../lib/labels';
import { useTaxRates } from '../../api/taxRates';
import { useUpdateWorkspace } from '../../api/workspaces';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { NumberInput } from '../../components/NumberInput';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';

interface Values {
  invoicePrefix: string;
  nextInvoiceNumber: number | null;
  invoiceNumberPadding: number | null;
  defaultPaymentTermsDays: number | null;
  defaultTaxRateId: string;
  invoiceFooter: string;
  requireInvoiceApproval: boolean;
  requireExpenseApproval: boolean;
}

export function InvoicingTab({ readOnly }: { readOnly: boolean }) {
  const { settings } = useWorkspace();
  const taxRates = useTaxRates();
  const update = useUpdateWorkspace();
  const toast = useToast();
  const form = useForm<Values, typeof updateWorkspaceSchema>({
    schema: updateWorkspaceSchema,
    initial: {
      invoicePrefix: settings.invoicePrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      invoiceNumberPadding: settings.invoiceNumberPadding,
      defaultPaymentTermsDays: settings.defaultPaymentTermsDays,
      defaultTaxRateId: settings.defaultTaxRateId ?? '',
      invoiceFooter: settings.invoiceFooter,
      requireInvoiceApproval: settings.requireInvoiceApproval,
      requireExpenseApproval: settings.requireExpenseApproval,
    },
    transform: (v) => ({
      settings: {
        invoicePrefix: v.invoicePrefix,
        nextInvoiceNumber: v.nextInvoiceNumber ?? undefined,
        invoiceNumberPadding: v.invoiceNumberPadding ?? undefined,
        defaultPaymentTermsDays: v.defaultPaymentTermsDays ?? undefined,
        defaultTaxRateId: v.defaultTaxRateId || null,
        invoiceFooter: v.invoiceFooter,
        requireInvoiceApproval: v.requireInvoiceApproval,
        requireExpenseApproval: v.requireExpenseApproval,
      },
    }),
    onSubmit: async (data) => {
      await update.mutateAsync(data);
      toast.success('Invoicing settings saved');
    },
  });
  const err = (k: string) => form.errors[`settings.${k}`] ?? form.errors[k];
  const preview = previewInvoiceNumbers(
    form.values.invoicePrefix,
    form.values.nextInvoiceNumber ?? 1,
    form.values.invoiceNumberPadding ?? 0,
  );

  return (
    <Form onSubmit={form.handleSubmit} aria-label="Invoicing settings">
      <FormError message={form.submitError} />
      <FormSection title="Numbering">
        <FormGrid>
          <Field label="Prefix" error={err('invoicePrefix')} hint="Letters and numbers only.">
            <Input
              value={form.values.invoicePrefix}
              onChange={(e) => form.setValue('invoicePrefix', e.target.value.toUpperCase())}
              maxLength={8}
              disabled={readOnly}
            />
          </Field>
          <Field label="Next number" error={err('nextInvoiceNumber')}>
            <NumberInput
              value={form.values.nextInvoiceNumber}
              onChange={(v) => form.setValue('nextInvoiceNumber', v)}
              min={1}
              disabled={readOnly}
            />
          </Field>
          <Field
            label="Padding"
            error={err('invoiceNumberPadding')}
            hint="Minimum digits, zero-filled."
          >
            <NumberInput
              value={form.values.invoiceNumberPadding}
              onChange={(v) => form.setValue('invoiceNumberPadding', v)}
              min={0}
              max={8}
              disabled={readOnly}
            />
          </Field>
          <Field label="Preview">
            <div className="number-preview" aria-live="polite">
              {preview.map((n) => (
                <code key={n}>{n}</code>
              ))}
            </div>
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Defaults">
        <FormGrid>
          <Field
            label="Payment terms"
            error={err('defaultPaymentTermsDays')}
            hint="Used for new clients."
          >
            <NumberInput
              value={form.values.defaultPaymentTermsDays}
              onChange={(v) => form.setValue('defaultPaymentTermsDays', v)}
              suffix="days"
              min={0}
              max={365}
              disabled={readOnly}
            />
          </Field>
          <Field label="Default tax rate" error={err('defaultTaxRateId')}>
            <Select
              value={form.values.defaultTaxRateId}
              onChange={(e) => form.setValue('defaultTaxRateId', e.target.value)}
              placeholder="No tax by default"
              disabled={readOnly}
              options={(taxRates.data ?? [])
                .filter((t) => !t.archived)
                .map((t) => ({ value: t.id, label: taxRateLabel(t) }))}
            />
          </Field>
          <Field label="Invoice footer" error={err('invoiceFooter')} className="span-2">
            <Textarea
              value={form.values.invoiceFooter}
              onChange={(e) => form.setValue('invoiceFooter', e.target.value)}
              rows={2}
              disabled={readOnly}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Approvals">
        <Field label="Require approval before invoices can be sent" inline>
          <Switch
            checked={form.values.requireInvoiceApproval}
            onChange={(v) => form.setValue('requireInvoiceApproval', v)}
            disabled={readOnly}
          />
        </Field>
        <Field label="Require approval before expenses post to the ledger" inline>
          <Switch
            checked={form.values.requireExpenseApproval}
            onChange={(v) => form.setValue('requireExpenseApproval', v)}
            disabled={readOnly}
          />
        </Field>
      </FormSection>
      {!readOnly ? (
        <FormActions>
          <Button type="submit" variant="primary" loading={form.submitting} disabled={!form.dirty}>
            Save changes
          </Button>
        </FormActions>
      ) : null}
    </Form>
  );
}
