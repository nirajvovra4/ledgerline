import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  inline?: boolean;
  className?: string;
  /** Extra content rendered right-aligned in the label row. */
  aside?: ReactNode;
  children: ReactNode;
  /** Explicit id when the child cannot accept one. */
  htmlFor?: string;
}

interface Labelled {
  id?: string;
  'aria-describedby'?: string;
  invalid?: boolean;
}

/** Label + control + hint/error, wiring ids and aria-describedby for the child control. */
export function Field({
  label,
  hint,
  error,
  required,
  inline,
  className,
  aside,
  children,
  htmlFor,
}: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  const descId = `${id}-desc`;
  const child = isValidElement<Labelled>(children)
    ? cloneElement(children as ReactElement<Labelled>, {
        id: (children as ReactElement<Labelled>).props.id ?? id,
        'aria-describedby': hint || error ? descId : undefined,
        ...(error ? { invalid: true } : {}),
      })
    : children;
  return (
    <div className={cx('field', inline && 'field--inline', className)}>
      <label className="field__label" htmlFor={id}>
        <span className={cx('field__label-text', required && 'is-required')}>{label}</span>
        {aside}
      </label>
      {child}
      {error ? (
        <div id={descId} className="field__error" role="alert">
          {error}
        </div>
      ) : hint ? (
        <div id={descId} className="field__hint">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
