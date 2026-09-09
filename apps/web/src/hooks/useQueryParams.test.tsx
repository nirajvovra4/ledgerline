import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useQueryParams } from './useQueryParams';

const DEFAULTS = { q: '', status: 'active', page: 1, uninvoiced: false };

function wrapperFor(url: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[url]}>{children}</MemoryRouter>
  );
}

describe('useQueryParams', () => {
  it('parses typed values from the URL with defaults', () => {
    const { result } = renderHook(() => useQueryParams(DEFAULTS), {
      wrapper: wrapperFor('/x?q=acme&page=3&uninvoiced=true'),
    });
    expect(result.current[0]).toEqual({ q: 'acme', status: 'active', page: 3, uninvoiced: true });
  });

  it('writes non-default values and strips defaults; filter changes reset page', () => {
    const { result } = renderHook(
      () => {
        const params = useQueryParams(DEFAULTS);
        const location = useLocation();
        return { params, search: location.search };
      },
      { wrapper: wrapperFor('/x?page=4') },
    );
    act(() => result.current.params[1]({ status: 'archived' }));
    expect(result.current.search).toBe('?status=archived');
    expect(result.current.params[0].page).toBe(1);

    act(() => result.current.params[1]({ page: 2 }));
    expect(result.current.search).toBe('?status=archived&page=2');

    act(() => result.current.params[1]({ status: 'active', uninvoiced: true }));
    expect(result.current.search).toBe('?uninvoiced=true');

    act(() => result.current.params[2]());
    expect(result.current.search).toBe('');
  });

  it('falls back to defaults for malformed numbers', () => {
    const { result } = renderHook(() => useQueryParams(DEFAULTS), {
      wrapper: wrapperFor('/x?page=abc'),
    });
    expect(result.current[0].page).toBe(1);
  });
});
