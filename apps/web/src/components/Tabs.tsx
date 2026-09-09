import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { cx } from '../lib/cx';

export interface TabItem<K extends string = string> {
  key: K;
  label: ReactNode;
  count?: number;
}

export interface TabsProps<K extends string> {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
  ariaLabel?: string;
  className?: string;
}

export function Tabs<K extends string>({
  items,
  value,
  onChange,
  ariaLabel,
  className,
}: TabsProps<K>) {
  return (
    <div className={cx('tabs', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === value}
          className={cx('tabs__tab', t.key === value && 'is-active')}
          onClick={() => onChange(t.key)}
        >
          {t.label}
          {t.count != null ? <span className="tabs__count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

/** Tabs whose active key lives in a URL search param (default `tab`). */
export function UrlTabs<K extends string>({
  items,
  param = 'tab',
  defaultKey,
  ariaLabel,
  className,
}: {
  items: TabItem<K>[];
  param?: string;
  defaultKey: K;
  ariaLabel?: string;
  className?: string;
}) {
  const [value, set] = useUrlTab(items, defaultKey, param);
  return (
    <Tabs items={items} value={value} onChange={set} ariaLabel={ariaLabel} className={className} />
  );
}

export function useUrlTab<K extends string>(
  items: TabItem<K>[],
  defaultKey: K,
  param = 'tab',
): [K, (key: K) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const value = (items.some((i) => i.key === raw) ? raw : defaultKey) as K;
  const set = (key: K) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (key === defaultKey) next.delete(param);
        else next.set(param, key);
        return next;
      },
      { replace: true },
    );
  return [value, set];
}
