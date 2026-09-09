import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  invoiceInputSchema,
  type AccountDto,
  type InvoiceDetailDto,
  type InvoiceInput,
  type TaxRateDto,
} from '@ledgerline/shared';
import { useClientOptions } from '../../../api/clients';
import { useProjectOptions } from '../../../api/projects';
import { Button } from '../../../components/Button';
import { Form, FormError } from '../../../components/Form';
import { Stepper } from '../../../components/Stepper';
import { useForm } from '../../../hooks/useForm';
import { useWorkspace } from '../../../hooks/useWorkspace';
import { modelFromEditor } from '../documentModel';
import {
  computeEditorTotals,
  stepForField,
  toInvoiceInput,
  type EditorValues,
} from './editorState';
import { StepClient } from './StepClient';
import { StepLines } from './StepLines';
import { StepReview } from './StepReview';
import { TotalsPanel } from './TotalsPanel';

const STEPS = [
  { key: 'client', label: 'Client & dates' },
  { key: 'lines', label: 'Lines' },
  { key: 'review', label: 'Review' },
];

export interface InvoiceEditorProps {
  initial: EditorValues;
  existing?: InvoiceDetailDto;
  taxRates: TaxRateDto[];
  accounts: AccountDto[];
  defaults: { accountId: string; taxRateId: string | null };
  onSubmit: (input: InvoiceInput) => Promise<void>;
  submitLabel: string;
}

export function InvoiceEditor({
  initial,
  existing,
  taxRates,
  accounts,
  defaults,
  onSubmit,
  submitLabel,
}: InvoiceEditorProps) {
  const { currency, base } = useWorkspace();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const clients = useClientOptions();
  const projects = useProjectOptions();

  const form = useForm<EditorValues, typeof invoiceInputSchema>({
    schema: invoiceInputSchema,
    initial,
    transform: toInvoiceInput,
    onSubmit: async (data) => {
      await onSubmit(data);
    },
  });
  const { values, errors, setValues } = form;
  const onChange = useCallback((patch: Partial<EditorValues>) => setValues(patch), [setValues]);

  const totals = useMemo(
    () => computeEditorTotals(values.lines, values.discountBp, taxRates),
    [values.lines, values.discountBp, taxRates],
  );
  const client = clients.data?.items.find((c) => c.id === values.clientId);
  const projectName = projects.data?.items.find((p) => p.id === values.projectId)?.name ?? null;
  const model = useMemo(
    () =>
      modelFromEditor(values, {
        number: existing?.number ?? '',
        currency,
        client,
        projectName,
        taxRates,
      }),
    [values, existing?.number, currency, client, projectName, taxRates],
  );

  // Jump to the first step with an error after a failed submit.
  const firstErrorStep = useMemo(() => {
    const keys = Object.keys(errors).filter((k) => k !== '_');
    if (keys.length === 0) return null;
    return Math.min(...keys.map(stepForField));
  }, [errors]);

  const stepOneReady = Boolean(values.clientId && values.issueDate && values.dueDate);

  const next = () => {
    if (step === 0 && !stepOneReady) {
      form.setErrors({
        ...(values.clientId ? {} : { clientId: 'Select a client to continue' }),
        ...(values.issueDate ? {} : { issueDate: 'Enter an issue date' }),
        ...(values.dueDate ? {} : { dueDate: 'Enter a due date' }),
      });
      return;
    }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };

  const submit = async () => {
    await form.handleSubmit();
  };

  const activeStep =
    firstErrorStep != null && firstErrorStep < step && !form.submitting ? firstErrorStep : step;
  if (activeStep !== step) setStep(activeStep);

  return (
    <div className="editor">
      <Form onSubmit={(e) => e.preventDefault()} aria-label="Invoice editor">
        <Stepper
          steps={STEPS}
          current={step}
          onSelect={setStep}
          maxReachable={stepOneReady ? 2 : 0}
        />
        <FormError message={form.submitError} />
        {step === 0 ? (
          <StepClient
            values={values}
            errors={errors}
            onChange={onChange}
            existingNumber={existing?.number}
          />
        ) : null}
        {step === 1 ? (
          <StepLines
            values={values}
            errors={errors}
            totals={totals}
            currency={currency}
            taxRates={taxRates}
            accounts={accounts}
            defaults={defaults}
            onChange={onChange}
          />
        ) : null}
        {step === 2 ? (
          <StepReview values={values} errors={errors} model={model} onChange={onChange} />
        ) : null}
        <div className="editor__nav">
          <Button
            variant="ghost"
            onClick={() =>
              navigate(existing ? `${base}/invoices/${existing.id}` : `${base}/invoices`)
            }
          >
            Cancel
          </Button>
          <div className="editor__nav-right">
            {step > 0 ? <Button onClick={() => setStep((s) => s - 1)}>Back</Button> : null}
            {step < STEPS.length - 1 ? (
              <Button variant="primary" onClick={next}>
                Continue
              </Button>
            ) : null}
            {step === STEPS.length - 1 || existing ? (
              <Button variant="primary" onClick={submit} loading={form.submitting}>
                {submitLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </Form>
      <div className="editor__aside">
        <TotalsPanel
          totals={totals}
          currency={currency}
          discountBp={values.discountBp}
          lineCount={values.lines.length}
        />
      </div>
    </div>
  );
}
