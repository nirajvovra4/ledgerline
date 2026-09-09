import { CURRENCIES, MONTH_NAMES, updateWorkspaceSchema } from '@ledgerline/shared';
import { useUpdateWorkspace } from '../../api/workspaces';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';

interface Values {
  name: string;
  currency: string;
  address: string;
  email: string;
  phone: string;
  fiscalYearStartMonth: number;
}

export function GeneralTab({ readOnly }: { readOnly: boolean }) {
  const { workspace, settings } = useWorkspace();
  const update = useUpdateWorkspace();
  const toast = useToast();
  const form = useForm<Values, typeof updateWorkspaceSchema>({
    schema: updateWorkspaceSchema,
    initial: {
      name: workspace.name,
      currency: workspace.currency,
      address: settings.address,
      email: settings.email,
      phone: settings.phone,
      fiscalYearStartMonth: settings.fiscalYearStartMonth,
    },
    transform: (v) => ({
      name: v.name,
      currency: v.currency,
      settings: {
        address: v.address,
        email: v.email,
        phone: v.phone,
        fiscalYearStartMonth: v.fiscalYearStartMonth,
      },
    }),
    onSubmit: async (data) => {
      await update.mutateAsync(data);
      toast.success('Workspace settings saved');
    },
  });
  const err = (k: string) => form.errors[k] ?? form.errors[`settings.${k}`];
  return (
    <Form onSubmit={form.handleSubmit} aria-label="General settings">
      <FormError message={form.submitError} />
      <FormSection title="Workspace">
        <FormGrid>
          <Field label="Name" error={err('name')} required>
            <Input
              value={form.values.name}
              onChange={(e) => form.setValue('name', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field
            label="Currency"
            error={err('currency')}
            hint="Changing the currency does not convert existing amounts."
          >
            <Select
              value={form.values.currency}
              onChange={(e) => form.setValue('currency', e.target.value)}
              disabled={readOnly}
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            />
          </Field>
          <Field label="Fiscal year starts" error={err('fiscalYearStartMonth')}>
            <Select
              value={String(form.values.fiscalYearStartMonth)}
              onChange={(e) => form.setValue('fiscalYearStartMonth', Number(e.target.value))}
              disabled={readOnly}
              options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection
        title="Contact details"
        description="Printed in the header of invoices and statements."
      >
        <FormGrid>
          <Field label="Address" error={err('address')} className="span-2">
            <Textarea
              value={form.values.address}
              onChange={(e) => form.setValue('address', e.target.value)}
              rows={3}
              disabled={readOnly}
            />
          </Field>
          <Field label="Email" error={err('email')}>
            <Input
              type="email"
              value={form.values.email}
              onChange={(e) => form.setValue('email', e.target.value)}
              disabled={readOnly}
            />
          </Field>
          <Field label="Phone" error={err('phone')}>
            <Input
              value={form.values.phone}
              onChange={(e) => form.setValue('phone', e.target.value)}
              disabled={readOnly}
            />
          </Field>
        </FormGrid>
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
