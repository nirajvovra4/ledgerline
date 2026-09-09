import {
  issuesByField,
  type ApiErrorBody,
  type ApiErrorCode,
  type FieldIssue,
} from '@ledgerline/shared';

export type QueryValue = string | number | boolean | null | undefined;
export type QueryParams = Record<string, QueryValue>;
export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface ApiFetchOptions {
  method?: HttpMethod;
  body?: unknown;
  query?: QueryParams;
  signal?: AbortSignal;
}

export type ApiErrorKind = ApiErrorCode | 'network_error' | 'bad_response';

function isFieldIssues(value: unknown): value is FieldIssue[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        v &&
        typeof v === 'object' &&
        typeof (v as FieldIssue).message === 'string' &&
        'path' in (v as object),
    )
  );
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorKind;
  readonly details: unknown;
  /** Field → message map derived from `details` when the server sent validation issues. */
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, code: ApiErrorKind, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.fieldErrors = isFieldIssues(details) ? issuesByField(details) : {};
  }

  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

/** Human-readable message for any thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong'): string {
  if (isApiError(error)) return error.message || fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'string') return error;
  return fallback;
}

/** Build a query string, skipping undefined, null and empty-string values. */
export function buildQuery(params?: QueryParams): string {
  if (!params) return '';
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

function isErrorBody(value: unknown): value is ApiErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof (value as ApiErrorBody).error === 'object' &&
    (value as ApiErrorBody).error !== null
  );
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;
  const url = `${path}${buildQuery(query)}`;
  const headers: Record<string, string> = { Accept: 'application/json' };
  const init: RequestInit = { method, credentials: 'include', headers, signal };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    throw new ApiError(
      0,
      'network_error',
      'Could not reach the server. Check your connection and try again.',
    );
  }

  let payload: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      if (response.ok)
        throw new ApiError(
          response.status,
          'bad_response',
          'The server returned an unreadable response.',
        );
      payload = null;
    }
  }

  if (!response.ok) {
    if (isErrorBody(payload)) {
      const { code, message, details } = payload.error;
      throw new ApiError(
        response.status,
        code,
        message || defaultMessage(response.status),
        details,
      );
    }
    throw new ApiError(
      response.status,
      codeForStatus(response.status),
      defaultMessage(response.status),
    );
  }
  return payload as T;
}

function codeForStatus(status: number): ApiErrorKind {
  switch (status) {
    case 400:
      return 'validation_error';
    case 401:
      return 'unauthenticated';
    case 403:
      return 'forbidden';
    case 404:
      return 'not_found';
    case 409:
      return 'conflict';
    case 422:
      return 'unbalanced_entry';
    default:
      return 'internal_error';
  }
}

function defaultMessage(status: number): string {
  switch (status) {
    case 400:
      return 'The request was invalid.';
    case 401:
      return 'You need to sign in.';
    case 403:
      return "You don't have permission to do that.";
    case 404:
      return 'Not found.';
    case 409:
      return 'That conflicts with an existing record.';
    default:
      return `Request failed (${status}).`;
  }
}

export const api = {
  get: <T>(path: string, query?: QueryParams, signal?: AbortSignal) =>
    apiFetch<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

export function wsPath(slug: string, rest = ''): string {
  return `/api/w/${encodeURIComponent(slug)}${rest}`;
}
