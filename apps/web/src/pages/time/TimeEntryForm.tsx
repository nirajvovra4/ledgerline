import { timeEntryInputSchema, type TimeEntryDto, type TimeEntryInput } from '@ledgerline/shared';
import { useProjectOptions } from '../../api/projects';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { DurationInput } from '../../components/DurationInput';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Switch } from '../../components/Switch';
import { useForm } from '../../hooks/useForm';

interface Values {
  projectId: string;
  date: string;
  minutes: number | null;
  description: string;
  billable: boolean;
}

export interface TimeEntryFormProps {
  entry?: TimeEntryDto;
  defaultDate: string;
  defaultProjectId?: string;
  onSubmit: (data: TimeEntryInput) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
  submitLabel?: string;
}

/** Quick-add row (compact) or inline edit form for a time entry. */
export function TimeEntryForm({
  entry,
  defaultDate,
  defaultProjectId,
  onSubmit,
  onCancel,
  compact,
  submitLabel,
}: TimeEntryFormProps) {
  const projects = useProjectOptions();
  const form = useForm<Values, typeof timeEntryInputSchema>({
    schema: timeEntryInputSchema,
    initial: {
      projectId: entry?.projectId ?? defaultProjectId ?? '',
      date: entry?.date ?? defaultDate,
      minutes: entry?.minutes ?? null,
      description: entry?.description ?? '',
      billable: entry?.billable ?? true,
    },
    transform: (v) => ({ ...v, minutes: v.minutes ?? undefined }),
    onSubmit: async (data, values) => {
      await onSubmit(data);
      if (!entry) form.reset({ ...values, minutes: null, description: '' });
    },
  });
  const projectOptions = (projects.data?.items ?? []).map((p) => ({
    value: p.id,
    label: `${p.clientName} — ${p.name}`,
  }));

  return (
    <Form
      onSubmit={form.handleSubmit}
      aria-label={entry ? 'Edit time entry' : 'Log time'}
      className={compact ? 'quick-add' : undefined}
      style={compact ? { gap: 8 } : undefined}
    >
      {!compact ? <FormError message={form.submitError} /> : null}
      <Field label="Project" error={form.errors.projectId} required>
        <Select
          value={form.values.projectId}
          onChange={(e) => form.setValue('projectId', e.target.value)}
          placeholder={projects.isLoading ? 'Loading…' : 'Project'}
          options={projectOptions}
          size={compact ? 'sm' : 'md'}
        />
      </Field>
      <Field label="Duration" error={form.errors.minutes} required>
        <DurationInput
          value={form.values.minutes}
          onChange={(v) => form.setValue('minutes', v)}
          size={compact ? 'sm' : 'md'}
        />
      </Field>
      <Field label="Description" error={form.errors.description}>
        <Input
          value={form.values.description}
          onChange={(e) => form.setValue('description', e.target.value)}
          placeholder="What did you work on?"
          size={compact ? 'sm' : 'md'}
        />
      </Field>
      {!compact ? (
        <Field label="Date" error={form.errors.date} required>
          <DateInput value={form.values.date} onChange={(v) => form.setValue('date', v)} />
        </Field>
      ) : null}
      <Field label="Billable" inline>
        <Switch
          checked={form.values.billable}
          onChange={(v) => form.setValue('billable', v)}
          aria-label="Billable"
        />
      </Field>
      <div className="row" style={{ gap: 6 }}>
        {onCancel ? (
          <Button variant="ghost" size={compact ? 'sm' : 'md'} onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button
          type="submit"
          variant="primary"
          size={compact ? 'sm' : 'md'}
          loading={form.submitting}
        >
          {submitLabel ?? (entry ? 'Save' : 'Log time')}
        </Button>
      </div>
      {compact && form.submitError ? (
        <div className="error-text" style={{ gridColumn: '1 / -1' }}>
          {form.submitError}
        </div>
      ) : null}
    </Form>
  );
}
