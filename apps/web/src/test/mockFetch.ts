import { vi } from 'vitest';

export interface MockRequest {
  url: URL;
  body: unknown;
  method: string;
}
export type MockResponder = (req: MockRequest) => unknown;

export interface MockRoute {
  method?: string;
  /** Path without query string; a RegExp may capture params. */
  path: string | RegExp;
  status?: number;
  /** Static JSON body or a function receiving the parsed request. */
  body: MockResponder | object | string | number | null | undefined;
}

export interface RecordedCall {
  method: string;
  url: URL;
  body: unknown;
}

/**
 * Installs a `fetch` stub that resolves routes in order. Unmatched requests return 404 with the
 * standard error envelope so components fail loudly rather than hang.
 */
export function mockFetch(routes: MockRoute[]) {
  const calls: RecordedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw =
      typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(raw, 'http://localhost');
    const method = (init?.method ?? 'GET').toUpperCase();
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    for (const route of routes) {
      if (route.method && route.method.toUpperCase() !== method) continue;
      const matches =
        typeof route.path === 'string'
          ? route.path === url.pathname
          : route.path.test(url.pathname);
      if (!matches) continue;
      const payload =
        typeof route.body === 'function'
          ? (route.body as MockResponder)({ url, body, method })
          : route.body;
      const status = route.status ?? 200;
      return new Response(payload === undefined ? '' : JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({
        error: { code: 'not_found', message: `No mock for ${method} ${url.pathname}` },
      }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls, restore: () => vi.unstubAllGlobals() };
}

export function errorBody(code: string, message: string, details?: unknown) {
  return { error: { code, message, details } };
}
