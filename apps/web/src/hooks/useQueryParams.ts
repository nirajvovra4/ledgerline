import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

export type ParamPrimitive = string | number | boolean;
export type ParamDefaults = Record<string, ParamPrimitive>;

function parseParam<T extends ParamPrimitive>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  if (typeof fallback === 'number') {
    const n = Number(raw);
    return (Number.isFinite(n) ? n : fallback) as T;
  }
  if (typeof fallback === 'boolean') {
    return (raw === 'true' || raw === '1') as T;
  }
  return raw as T;
}

function serialise(value: ParamPrimitive): string {
  return typeof value === 'boolean' ? (value ? 'true' : 'false') : String(value);
}

export type SetQueryParams<T> = (
  patch: Partial<T> | ((current: T) => Partial<T>),
  options?: { replace?: boolean },
) => void;

/**
 * Typed URL search-param state. Keys equal to their default are removed from the URL so links stay
 * clean; setting a filter resets `page` to 1 unless the patch sets it explicitly.
 */
export function useQueryParams<T extends ParamDefaults>(
  defaults: T,
): [T, SetQueryParams<T>, () => void] {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const out = { ...defaults } as Record<string, ParamPrimitive>;
    for (const key of Object.keys(defaults)) {
      out[key] = parseParam(searchParams.get(key), defaults[key] as ParamPrimitive);
    }
    return out as T;
  }, [searchParams, defaults]);

  const set = useCallback<SetQueryParams<T>>(
    (patch, options) => {
      setSearchParams(
        (prev) => {
          const current = { ...defaults } as Record<string, ParamPrimitive>;
          for (const key of Object.keys(defaults))
            current[key] = parseParam(prev.get(key), defaults[key] as ParamPrimitive);
          const resolved = typeof patch === 'function' ? patch(current as T) : patch;
          const next = new URLSearchParams(prev);
          const touchesFilter = Object.keys(resolved).some(
            (k) => k !== 'page' && k !== 'sort' && k !== 'dir',
          );
          if (touchesFilter && 'page' in defaults && !('page' in resolved)) next.delete('page');
          for (const [key, value] of Object.entries(resolved)) {
            if (value === undefined || value === null || value === defaults[key] || value === '')
              next.delete(key);
            else next.set(key, serialise(value as ParamPrimitive));
          }
          return next;
        },
        { replace: options?.replace ?? true },
      );
    },
    [defaults, setSearchParams],
  );

  const reset = useCallback(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const key of Object.keys(defaults)) next.delete(key);
        return next;
      },
      { replace: true },
    );
  }, [defaults, setSearchParams]);

  return [values, set, reset];
}
