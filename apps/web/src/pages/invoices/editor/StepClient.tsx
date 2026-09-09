import { addDays, formatDate, type ClientDto } from '@ledgerline/shared';
import { useClientOptions } from '../../../api/clients';
import { useProjectOptions } from '../../../api/projects';
import { DateInput } from '../../../components/DateInput';
import { Field } from '../../../components/Field';
import { FormGrid, FormSection } from '../../../components/Form';
import { Input } from '../../../components/Input';
import { Select } from '../../../components/Select';
import type { FieldErrors } from '../../../hooks/useForm';
import type { EditorValues } from './editorState';

export function StepClient({
  values,
  errors,
  onChange,
  existingNumber,
}: {
  values: EditorValues;
  errors: FieldErrors;
  onChange: (patch: Partial<EditorValues>) => void;
  existingNumber?: string;
}) {
  const clients = useClientOptions();
  const projects = useProjectOptions(values.clientId || undefined);
  const client: ClientDto | undefined = clients.data?.items.find((c) => c.id === values.clientId);

  const selectClient = (clientId: string) => {
    const c = clients.data?.items.find((x) => x.id === clientId);
    onChange({
      clientId,
      projectId: '',
      dueDate: c ? addDays(values.issueDate, c.paymentTermsDays) : values.dueDate,
    });
  };

  return (
    <FormSection
      title="Client & dates"
      description={
        existingNumber
          ? `Editing ${existingNumber}`
          : 'Numbers are assigned when the invoice is created.'
      }
    >
      <FormGrid>
        <Field
          label="Client"
          error={errors.clientId}
          required
          hint={
            client
              ? `Terms: ${client.paymentTermsDays} days${client.email ? ` · ${client.email}` : ''}`
              : undefined
          }
        >
          <Select
            value={values.clientId}
            onChange={(e) => selectClient(e.target.value)}
            placeholder={clients.isLoading ? 'Loading clients…' : 'Choose a client'}
            options={(clients.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))}
            autoFocus
          />
        </Field>
        <Field
          label="Project"
          error={errors.projectId}
          hint="Optional — filtered to the selected client."
        >
          <Select
            value={values.projectId}
            onChange={(e) => onChange({ projectId: e.target.value })}
            placeholder={values.clientId ? 'No project' : 'Choose a client first'}
            disabled={!values.clientId}
            options={(projects.data?.items ?? []).map((p) => ({
              value: p.id,
              label: p.code ? `${p.code} · ${p.name}` : p.name,
            }))}
          />
        </Field>
        <Field label="Issue date" error={errors.issueDate} required>
          <DateInput
            value={values.issueDate}
            onChange={(issueDate) => {
              if (!issueDate) return;
              const terms = client?.paymentTermsDays ?? 30;
              onChange({ issueDate, dueDate: addDays(issueDate, terms) });
            }}
          />
        </Field>
        <Field
          label="Due date"
          error={errors.dueDate}
          required
          hint={values.dueDate ? `Due ${formatDate(values.dueDate, 'long')}` : undefined}
        >
          <DateInput value={values.dueDate} onChange={(dueDate) => onChange({ dueDate })} />
        </Field>
        <Field
          label="PO number"
          error={errors.poNumber}
          hint="Shown on the document if the client issued one."
        >
          <Input value={values.poNumber} onChange={(e) => onChange({ poNumber: e.target.value })} />
        </Field>
      </FormGrid>
    </FormSection>
  );
}
