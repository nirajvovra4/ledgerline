import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cx } from '../lib/cx';

export interface MenuItem {
  key: string;
  label: ReactNode;
  onSelect?: () => void;
  to?: string;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  icon?: ReactNode;
}

export type MenuEntry =
  MenuItem | { separator: true; key: string } | { heading: ReactNode; key: string };

export interface DropdownProps {
  trigger: (props: {
    open: boolean;
    toggle: () => void;
    'aria-expanded': boolean;
    'aria-haspopup': 'menu';
    id: string;
  }) => ReactNode;
  items: MenuEntry[];
  align?: 'left' | 'right';
  direction?: 'down' | 'up';
  header?: ReactNode;
  className?: string;
}

/** Keyboard-operable popover menu: arrows move, Enter selects, Escape closes. */
export function Dropdown({
  trigger,
  items,
  align = 'right',
  direction = 'down',
  header,
  className,
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLUListElement>(null);
  const id = useId();

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => setOpen((o) => !o), []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDoc);
    const first = menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])');
    first?.focus();
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, close]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      rootRef.current?.querySelector<HTMLElement>(`[aria-controls="${id}"]`)?.focus();
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const list = Array.from(
      menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [],
    );
    if (list.length === 0) return;
    const idx = list.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === 'ArrowDown' ? (idx + 1) % list.length : (idx - 1 + list.length) % list.length;
    list[next]?.focus();
  };

  return (
    <div ref={rootRef} className={cx('dropdown', className)}>
      {trigger({ open, toggle, 'aria-expanded': open, 'aria-haspopup': 'menu', id })}
      {open ? (
        <ul
          ref={menuRef}
          id={id}
          role="menu"
          className={cx('menu', align === 'left' && 'menu--left', direction === 'up' && 'menu--up')}
          onKeyDown={onKeyDown}
        >
          {header ? <li role="presentation">{header}</li> : null}
          {items.map((item) => {
            if ('separator' in item)
              return <li key={item.key} role="separator" className="menu__sep" />;
            if ('heading' in item)
              return (
                <li key={item.key} role="presentation" className="menu__label">
                  {item.heading}
                </li>
              );
            const cls = cx(
              'menu__item',
              item.danger && 'menu__item--danger',
              item.active && 'is-active',
            );
            return (
              <li key={item.key} role="none">
                {item.to && !item.disabled ? (
                  <Link role="menuitem" to={item.to} className={cls} onClick={close}>
                    {item.icon}
                    {item.label}
                  </Link>
                ) : (
                  <button
                    type="button"
                    role="menuitem"
                    className={cls}
                    disabled={item.disabled}
                    onClick={() => {
                      close();
                      item.onSelect?.();
                    }}
                  >
                    {item.icon}
                    {item.label}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
