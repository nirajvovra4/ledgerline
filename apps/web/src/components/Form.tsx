import type { FormHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/cx';

export function Form({ className, children, ...rest }: FormHTMLAttributes<HTMLFormElement>) {
  return (
    <form className={cx('form', className)} noValidate {...rest}>
      {children}
    </form>
  );
}

export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('form__grid', className)}>{children}</div>;
}

export function FormSection({
  title,
  children,
  description,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="form__section">
      {title ? <h3 className="form__section-title">{title}</h3> : null}
      {description ? <p className="hint-text">{description}</p> : null}
      {children}
    </section>
  );
}

export function FormActions({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('form__actions', className)}>{children}</div>;
}

export function FormError({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <div className="form__error" role="alert">
      {message}
    </div>
  );
}
