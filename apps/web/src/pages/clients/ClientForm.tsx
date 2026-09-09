import { useNavigate } from 'react-router-dom';
import { clientInputSchema, type ClientDto, type ClientInput } from '@ledgerline/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { NumberInput } from '../../components/NumberInput';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useWorkspace } from '../../hooks/useWorkspace';

export interface ClientFormValues {
  name: string;
  company: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  taxId: string;
  paymentTermsDays: number | null;
  notes: string;
  status: 'active' | 'archived';
}

export function clientToValues(
  client: ClientDto | undefined,
  defaultTerms: number,
): ClientFormValues {
  return {
    name: client?.name ?? '',
    company: client?.company ?? '',
    email: client?.email ?? '',
    phone: client?.phone ?? '',
    addressLine1: client?.addressLine1 ?? '',
    addressLine2: client?.addressLine2 ?? '',
    city: client?.city ?? '',
    region: client?.region ?? '',
    postalCode: client?.postalCode ?? '',
    country: client?.country ?? '',
    taxId: client?.taxId ?? '',
    paymentTermsDays: client?.paymentTermsDays ?? defaultTerms,
    notes: client?.notes ?? '',
    status: client?.status ?? 'active',
  };
}

export function ClientForm({
  client,
  onSubmit,
  submitLabel,
}: {
  client?: ClientDto;
  onSubmit: (data: ClientInput) => Promise<void>;
  submitLabel: string;
}) {
  const { settings, base } = useWorkspace();
  const navigate = useNavigate();
  const form = useForm({
    schema: clientInputSchema,
    initial: clientToValues(client, settings.defaultPaymentTermsDays),
    transform: (v) => ({ ...v, paymentTermsDays: v.paymentTermsDays ?? undefined }),
    onSubmit,
  });
  const text = (name: keyof ClientFormValues) => ({
    value: String(form.values[name] ?? ''),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      form.setValue(name, e.target.value as never),
  });

  return (
    <Form onSubmit={form.handleSubmit} aria-label={client ? 'Edit client' : 'New client'}>
      <FormError message={form.submitError} />
      <FormSection title="Contact">
        <FormGrid>
          <Field label="Client name" error={form.errors.name} required>
            <Input {...text('name')} autoFocus placeholder="Acme Studios" />
          </Field>
          <Field label="Company" error={form.errors.company}>
            <Input {...text('company')} />
          </Field>
          <Field label="Email" error={form.errors.email}>
            <Input type="email" {...text('email')} />
          </Field>
          <Field label="Phone" error={form.errors.phone}>
            <Input type="tel" {...text('phone')} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Address">
        <FormGrid>
          <Field label="Address line 1" error={form.errors.addressLine1} className="span-2">
            <Input {...text('addressLine1')} />
          </Field>
          <Field label="Address line 2" error={form.errors.addressLine2} className="span-2">
            <Input {...text('addressLine2')} />
          </Field>
          <Field label="City" error={form.errors.city}>
            <Input {...text('city')} />
          </Field>
          <Field label="Region / state" error={form.errors.region}>
            <Input {...text('region')} />
          </Field>
          <Field label="Postal code" error={form.errors.postalCode}>
            <Input {...text('postalCode')} />
          </Field>
          <Field label="Country" error={form.errors.country}>
            <Input {...text('country')} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Billing">
        <FormGrid>
          <Field label="Tax ID" error={form.errors.taxId}>
            <Input {...text('taxId')} />
          </Field>
          <Field
            label="Payment terms"
            error={form.errors.paymentTermsDays}
            hint="Days from issue date to due date."
            required
          >
            <NumberInput
              value={form.values.paymentTermsDays}
              onChange={(v) => form.setValue('paymentTermsDays', v)}
              suffix="days"
              min={0}
              max={365}
            />
          </Field>
          <Field label="Status" error={form.errors.status}>
            <Select
              value={form.values.status}
              onChange={(e) => form.setValue('status', e.target.value as 'active' | 'archived')}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          </Field>
          <Field label="Notes" error={form.errors.notes} className="span-2">
            <Textarea {...text('notes')} rows={3} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button
          variant="ghost"
          onClick={() => navigate(client ? `${base}/clients/${client.id}` : `${base}/clients`)}
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
