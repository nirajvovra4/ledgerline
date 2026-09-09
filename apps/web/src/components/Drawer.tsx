import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cx } from '../lib/cx';
import { useFocusTrap } from './useFocusTrap';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
  locked?: boolean;
}

export function Drawer({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
  locked,
}: DrawerProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useFocusTrap(ref, open, locked ? undefined : onClose);
  if (!open) return null;
  return createPortal(
    <div
      className="overlay overlay--drawer"
      onMouseDown={(e) => {
        if (!locked && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        className={cx('drawer', size === 'lg' && 'drawer--lg')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer__head">
          <h2 className="drawer__title" id={titleId}>
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
        <div className="drawer__body" data-focus-body>
          {children}
        </div>
        {footer ? <div className="drawer__foot">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
