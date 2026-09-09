import { Field } from '../../../components/Field';
import { FormGrid, FormSection } from '../../../components/Form';
import { Textarea } from '../../../components/Textarea';
import type { FieldErrors } from '../../../hooks/useForm';
import { InvoiceDocument, type DocumentModel } from '../InvoiceDocument';
import type { EditorValues } from './editorState';

export function StepReview({
  values,
  errors,
  model,
  onChange,
}: {
  values: EditorValues;
  errors: FieldErrors;
  model: DocumentModel;
  onChange: (patch: Partial<EditorValues>) => void;
}) {
  return (
    <div className="stack stack--lg">
      <FormSection title="Notes & terms">
        <FormGrid>
          <Field label="Notes to client" error={errors.notes} hint="Printed under the totals.">
            <Textarea
              value={values.notes}
              onChange={(e) => onChange({ notes: e.target.value })}
              rows={3}
            />
          </Field>
          <Field label="Terms" error={errors.terms} hint="Payment terms and conditions.">
            <Textarea
              value={values.terms}
              onChange={(e) => onChange({ terms: e.target.value })}
              rows={3}
            />
          </Field>
        </FormGrid>
      </FormSection>
      <FormSection title="Preview">
        <InvoiceDocument model={model} preview />
      </FormSection>
    </div>
  );
}
