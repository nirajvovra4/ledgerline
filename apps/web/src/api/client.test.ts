import { afterEach, describe, expect, it } from 'vitest';
import { apiFetch, ApiError, buildQuery, errorMessage } from './client';
import { errorBody, mockFetch } from '../test/mockFetch';

afterEach(() => {
  // restore fetch between tests
  (globalThis as { fetch?: unknown }).fetch = undefined;
});

describe('buildQuery', () => {
  it('skips undefined, null and empty values and encodes the rest', () => {
    expect(
      buildQuery({ q: 'acme co', page: 2, status: undefined, sort: null, dir: '', billable: true }),
    ).toBe('?q=acme+co&page=2&billable=true');
    expect(buildQuery({})).toBe('');
    expect(buildQuery()).toBe('');
  });
});

describe('apiFetch', () => {
  it('sends JSON with credentials and parses the response', async () => {
    const { calls, fn } = mockFetch([
      { method: 'POST', path: '/api/auth/login', body: { user: { id: '1' } } },
    ]);
    const res = await apiFetch<{ user: { id: string } }>('/api/auth/login', {
      method: 'POST',
      body: { email: 'a@b.c', password: 'x' },
    });
    expect(res.user.id).toBe('1');
    expect(calls[0]?.body).toEqual({ email: 'a@b.c', password: 'x' });
    const init = fn.mock.calls[0]?.[1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('appends a query string', async () => {
    const { calls } = mockFetch([
      { path: '/api/w/x/clients', body: { items: [], total: 0, page: 1, pageSize: 25 } },
    ]);
    await apiFetch('/api/w/x/clients', { query: { q: 'acme', page: 1, status: '' } });
    expect(calls[0]?.url.search).toBe('?q=acme&page=1');
  });

  it('throws ApiError with fieldErrors derived from validation details', async () => {
    mockFetch([
      {
        method: 'POST',
        path: '/api/w/x/clients',
        status: 400,
        body: errorBody('validation_error', 'Validation failed', [
          { path: 'name', message: 'Client name is required', code: 'too_small' },
          { path: 'email', message: 'Enter a valid email address', code: 'invalid_string' },
          { path: 'email', message: 'second message ignored', code: 'custom' },
        ]),
      },
    ]);
    const err = await apiFetch('/api/w/x/clients', { method: 'POST', body: {} }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiError);
    const apiErr = err as ApiError;
    expect(apiErr.status).toBe(400);
    expect(apiErr.code).toBe('validation_error');
    expect(apiErr.hasFieldErrors).toBe(true);
    expect(apiErr.fieldErrors).toEqual({
      name: 'Client name is required',
      email: 'Enter a valid email address',
    });
  });

  it('maps non-envelope errors to a status-based code', async () => {
    mockFetch([{ path: '/api/auth/me', status: 401, body: undefined }]);
    const err = (await apiFetch('/api/auth/me').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('unauthenticated');
    expect(err.isUnauthenticated).toBe(true);
    expect(err.fieldErrors).toEqual({});
  });

  it('wraps network failures', async () => {
    (globalThis as { fetch: unknown }).fetch = async () => {
      throw new TypeError('Failed to fetch');
    };
    const err = (await apiFetch('/api/meta').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('network_error');
    expect(err.status).toBe(0);
    expect(errorMessage(err)).toMatch(/reach the server/);
  });
});
