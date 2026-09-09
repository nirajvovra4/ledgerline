import { useNavigate } from 'react-router-dom';
import {
  PROJECT_STATUSES,
  projectInputSchema,
  type BillingType,
  type ProjectDto,
  type ProjectInput,
  type ProjectStatus,
} from '@ledgerline/shared';
import { useClientOptions } from '../../api/clients';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError, FormGrid, FormSection } from '../../components/Form';
import { Input } from '../../components/Input';
import { MoneyInput } from '../../components/MoneyInput';
import { Segmented } from '../../components/Segmented';
import { Select } from '../../components/Select';
import { Textarea } from '../../components/Textarea';
import { useForm } from '../../hooks/useForm';
import { useWorkspace } from '../../hooks/useWorkspace';

interface Values {
  clientId: string;
  name: string;
  code: string;
  description: string;
  status: ProjectStatus;
  billingType: BillingType;
  hourlyRateCents: number | null;
  budgetCents: number | null;
  startDate: string;
  endDate: string;
}

export function ProjectForm({
  project,
  defaultClientId,
  onSubmit,
  submitLabel,
}: {
  project?: ProjectDto;
  defaultClientId?: string;
  onSubmit: (data: ProjectInput) => Promise<void>;
  submitLabel: string;
}) {
  const { base, currency } = useWorkspace();
  const navigate = useNavigate();
  const clients = useClientOptions();
  const form = useForm<Values, typeof projectInputSchema>({
    schema: projectInputSchema,
    initial: {
      clientId: project?.clientId ?? defaultClientId ?? '',
      name: project?.name ?? '',
      code: project?.code ?? '',
      description: project?.description ?? '',
      status: project?.status ?? 'active',
      billingType: project?.billingType ?? 'hourly',
      hourlyRateCents: project?.hourlyRateCents ?? 0,
      budgetCents: project?.budgetCents ?? 0,
      startDate: project?.startDate ?? '',
      endDate: project?.endDate ?? '',
    },
    transform: (v) => ({
      ...v,
      hourlyRateCents: v.hourlyRateCents ?? undefined,
      budgetCents: v.budgetCents ?? undefined,
    }),
    onSubmit,
  });
  const hourly = form.values.billingType === 'hourly';

  return (
    <Form onSubmit={form.handleSubmit} aria-label={project ? 'Edit project' : 'New project'}>
      <FormError message={form.submitError} />
      <FormSection title="Project">
        <FormGrid>
          <Field label="Client" error={form.errors.clientId} required>
            <Select
              value={form.values.clientId}
              onChange={(e) => form.setValue('clientId', e.target.value)}
              placeholder={clients.isLoading ? 'Loading clients…' : 'Choose a client'}
              options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </Field>
          <Field label="Status" error={form.errors.status}>
            <Select
              value={form.values.status}
              onChange={(e) => form.setValue('status', e.target.value as ProjectStatus)}
              options={PROJECT_STATUSES.map((s) => ({ value: s.value, label: s.label }))}
            />
          </Field>
          <Field label="Project name" error={form.errors.name} required>
            <Input
              value={form.values.name}
              onChange={(e) => form.setValue('name', e.target.value)}
              autoFocus
              placeholder="Website redesign"
            />
          </Field>
          <Field
            label="Code"
            error={form.errors.code}
            hint="Short reference shown on time entries and invoices."
          >
            <Input
              value={form.values.code}
              onChange={(e) => form.setValue('code', e.target.value.toUpperCase())}
              placeholder="WEB-01"
              maxLength={12}
            />
          </Field>
          <Field label="Description" error={form.errors.description} className="span-2">
            <Textarea
              value={form.values.description}
              onChange={(e) => form.setValue('description', e.target.value)}
              rows={3}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Billing">
        <Field label="Billing type" error={form.errors.billingType}>
          <Segmented
            ariaLabel="Billing type"
            value={form.values.billingType}
            onChange={(v) => form.setValue('billingType', v)}
            options={[
              { value: 'hourly', label: 'Hourly' },
              { value: 'fixed', label: 'Fixed price' },
            ]}
          />
        </Field>
        <FormGrid>
          {hourly ? (
            <Field label="Hourly rate" error={form.errors.hourlyRateCents} required>
              <MoneyInput
                currency={currency}
                value={form.values.hourlyRateCents}
                onChange={(v) => form.setValue('hourlyRateCents', v)}
                allowNegative={false}
              />
            </Field>
          ) : null}
          <Field
            label={hourly ? 'Budget (optional)' : 'Fixed price'}
            error={form.errors.budgetCents}
            hint={
              hourly
                ? 'Used to show budget burn on the project page.'
                : 'Total agreed fee for the project.'
            }
          >
            <MoneyInput
              currency={currency}
              value={form.values.budgetCents}
              onChange={(v) => form.setValue('budgetCents', v)}
              allowNegative={false}
            />
          </Field>
          <Field label="Start date" error={form.errors.startDate}>
            <DateInput
              value={form.values.startDate}
              onChange={(v) => form.setValue('startDate', v)}
            />
          </Field>
          <Field label="End date" error={form.errors.endDate}>
            <DateInput value={form.values.endDate} onChange={(v) => form.setValue('endDate', v)} />
          </Field>
        </FormGrid>
      </FormSection>
      <FormActions>
        <Button
          variant="ghost"
          onClick={() => navigate(project ? `${base}/projects/${project.id}` : `${base}/projects`)}
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
