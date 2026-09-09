import { useCallback, useMemo, useState, type FormEvent } from 'react';
import type { z, ZodTypeAny } from 'zod';
import { issuesByField, validate } from '@ledgerline/shared';
import { errorMessage, isApiError } from '../api/client';

export type FieldErrors = Record<string, string>;

export interface UseFormOptions<V extends object, S extends ZodTypeAny> {
  schema: S;
  initial: V;
  /** Convert form values (often strings) into the shape the schema expects. Defaults to identity. */
  transform?: (values: V) => unknown;
  onSubmit: (data: z.output<S>, values: V) => Promise<void> | void;
}

export interface UseFormResult<V extends object> {
  values: V;
  errors: FieldErrors;
  submitting: boolean;
  submitError: string | null;
  dirty: boolean;
  setValue: <K extends keyof V>(name: K, value: V[K]) => void;
  setValues: (patch: Partial<V> | ((current: V) => Partial<V>)) => void;
  setErrors: (errors: FieldErrors) => void;
  setFieldError: (name: string, message: string | undefined) => void;
  clearErrors: () => void;
  reset: (next?: V) => void;
  handleSubmit: (event?: FormEvent) => Promise<void>;
  /** Props for a controlled text field. */
  field: <K extends keyof V>(
    name: K,
  ) => { name: string; value: V[K]; onChange: (value: V[K]) => void; error: string | undefined };
  errorFor: (name: string) => string | undefined;
}

/**
 * Small form state hook: keeps values, runs the zod schema on submit, maps issues to field errors
 * (dotted paths such as `lines.0.description`) and surfaces server-side `fieldErrors` from ApiError.
 */
export function useForm<V extends object, S extends ZodTypeAny>(
  options: UseFormOptions<V, S>,
): UseFormResult<V> {
  const { schema, initial, transform, onSubmit } = options;
  const [values, setValuesState] = useState<V>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const setValue = useCallback(<K extends keyof V>(name: K, value: V[K]) => {
    setValuesState((v) => ({ ...v, [name]: value }));
    setDirty(true);
    setErrors((e) => {
      if (!(String(name) in e)) return e;
      const next = { ...e };
      delete next[String(name)];
      return next;
    });
  }, []);

  const setValues = useCallback((patch: Partial<V> | ((current: V) => Partial<V>)) => {
    setValuesState((v) => ({ ...v, ...(typeof patch === 'function' ? patch(v) : patch) }));
    setDirty(true);
  }, []);

  const setFieldError = useCallback((name: string, message: string | undefined) => {
    setErrors((e) => {
      const next = { ...e };
      if (message) next[name] = message;
      else delete next[name];
      return next;
    });
  }, []);

  const clearErrors = useCallback(() => {
    setErrors({});
    setSubmitError(null);
  }, []);

  const reset = useCallback(
    (next?: V) => {
      setValuesState(next ?? initial);
      setErrors({});
      setSubmitError(null);
      setDirty(false);
    },
    [initial],
  );

  const handleSubmit = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      setSubmitError(null);
      const candidate = transform ? transform(values) : values;
      const result = validate(schema, candidate);
      if (!result.ok) {
        const mapped = issuesByField(result.issues);
        setErrors(mapped);
        if (mapped._) setSubmitError(mapped._);
        return;
      }
      setSubmitting(true);
      try {
        await onSubmit(result.data, values);
        setErrors({});
        setDirty(false);
      } catch (err) {
        if (isApiError(err) && err.hasFieldErrors) {
          setErrors(err.fieldErrors);
          setSubmitError(err.fieldErrors._ ?? err.message);
        } else {
          setSubmitError(errorMessage(err));
        }
      } finally {
        setSubmitting(false);
      }
    },
    [values, schema, transform, onSubmit],
  );

  const errorFor = useCallback((name: string) => errors[name], [errors]);

  const field = useCallback(
    <K extends keyof V>(name: K) => ({
      name: String(name),
      value: values[name],
      onChange: (value: V[K]) => setValue(name, value),
      error: errors[String(name)],
    }),
    [values, errors, setValue],
  );

  return useMemo(
    () => ({
      values,
      errors,
      submitting,
      submitError,
      dirty,
      setValue,
      setValues,
      setErrors,
      setFieldError,
      clearErrors,
      reset,
      handleSubmit,
      field,
      errorFor,
    }),
    [
      values,
      errors,
      submitting,
      submitError,
      dirty,
      setValue,
      setValues,
      setFieldError,
      clearErrors,
      reset,
      handleSubmit,
      field,
      errorFor,
    ],
  );
}

/** Helper for number fields held as strings: '' → undefined so zod reports "required". */
export function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}
