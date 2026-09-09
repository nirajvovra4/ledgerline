import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { Tone } from '@ledgerline/shared';
import { cx } from '../lib/cx';

export interface ToastOptions {
  title: string;
  body?: string;
  tone?: Tone;
  durationMs?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

interface ToastApi {
  toast: (options: ToastOptions) => void;
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
  info: (title: string, body?: string) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback(
    (id: number) => setItems((list) => list.filter((t) => t.id !== id)),
    [],
  );

  const toast = useCallback(
    (options: ToastOptions) => {
      const id = ++counter.current;
      setItems((list) => [...list.slice(-4), { ...options, id }]);
      const duration = options.durationMs ?? (options.tone === 'negative' ? 7000 : 4000);
      setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      toast,
      success: (title, body) => toast({ title, body, tone: 'positive' }),
      error: (title, body) => toast({ title, body, tone: 'negative' }),
      info: (title, body) => toast({ title, body, tone: 'info' }),
      dismiss,
    }),
    [toast, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toaster" role="region" aria-label="Notifications" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={cx('toast', t.tone && `toast--${t.tone}`)} role="status">
            <div>
              <div className="toast__title">{t.title}</div>
              {t.body ? <div className="toast__body">{t.body}</div> : null}
            </div>
            <button
              type="button"
              className="toast__close"
              aria-label="Dismiss"
              onClick={() => dismiss(t.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
