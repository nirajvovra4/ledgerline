import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { useFocusTrap } from './useFocusTrap';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  /** Prevent closing by clicking the backdrop (e.g. while submitting). */
  locked?: boolean;
}

export function Modal({ open, onClose, title, children, footer, size = 'md', locked }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, locked ? undefined : onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="overlay"
      onMouseDown={(e) => {
        if (!locked && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cx('modal', size === 'lg' && 'modal--lg')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="modal__head">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            aria-label="Close"
            disabled={locked}
          >
            ×
          </button>
        </div>
        <div className="modal__body" data-focus-body>
          {children}
        </div>
        {footer ? <div className="modal__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
