import { useState, type ReactNode } from 'react';
import { errorMessage } from '../api/client';
import { Button, type ButtonVariant } from './Button';
import { Field } from './Field';
import { FormError } from './Form';
import { Modal } from './Modal';
import { Textarea } from './Textarea';

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (comment: string) => Promise<unknown> | unknown;
  title: ReactNode;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  /** Ask for a free-text comment; `required` blocks confirmation until filled. */
  comment?: { label: string; required?: boolean; placeholder?: string };
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  comment,
}: ConfirmDialogProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const missing = Boolean(comment?.required) && text.trim().length === 0;

  const confirm = async () => {
    if (missing) {
      setError(`${comment?.label ?? 'A comment'} is required`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(text.trim());
      setText('');
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) {
          setText('');
          setError(null);
          onClose();
        }
      }}
      title={title}
      locked={busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={variant}
            onClick={confirm}
            loading={busy}
            disabled={missing}
            data-autofocus={!comment}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="stack">
        {message ? <div>{message}</div> : null}
        {comment ? (
          <Field label={comment.label} required={comment.required} error={error ?? undefined}>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={comment.placeholder}
              rows={3}
              data-autofocus
            />
          </Field>
        ) : (
          <FormError message={error} />
        )}
      </div>
    </Modal>
  );
}
