import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/cx';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      className={cx('textarea', invalid && 'textarea--invalid', className)}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
});
