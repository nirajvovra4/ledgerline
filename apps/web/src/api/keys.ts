import type { QueryParams } from './client';

/** Root of every workspace-scoped query so one invalidation can sweep a workspace. */
export const wsKey = (slug: string) => ['w', slug] as const;

export function resourceKeys<Name extends string>(name: Name) {
  return {
    all: (slug: string) => [...wsKey(slug), name] as const,
    lists: (slug: string) => [...wsKey(slug), name, 'list'] as const,
    list: (slug: string, params: QueryParams = {}) =>
      [...wsKey(slug), name, 'list', params] as const,
    details: (slug: string) => [...wsKey(slug), name, 'detail'] as const,
    detail: (slug: string, id: string) => [...wsKey(slug), name, 'detail', id] as const,
    sub: (slug: string, id: string, part: string, params: QueryParams = {}) =>
      [...wsKey(slug), name, 'detail', id, part, params] as const,
  };
}

export const authKeys = {
  me: ['auth', 'me'] as const,
};
export const metaKeys = {
  meta: ['meta'] as const,
};
export const workspaceKeys = {
  list: ['workspaces'] as const,
  detail: (slug: string) => [...wsKey(slug), 'workspace'] as const,
  members: (slug: string) => [...wsKey(slug), 'members'] as const,
  dashboard: (slug: string, range: string) => [...wsKey(slug), 'dashboard', range] as const,
  activity: (slug: string, params: QueryParams = {}) =>
    [...wsKey(slug), 'activity', params] as const,
  search: (slug: string, q: string) => [...wsKey(slug), 'search', q] as const,
  calendar: (slug: string, month: string) => [...wsKey(slug), 'calendar', month] as const,
};
export const clientKeys = resourceKeys('clients');
export const projectKeys = resourceKeys('projects');
export const timeKeys = {
  ...resourceKeys('time-entries'),
  summary: (slug: string, from: string, to: string) =>
    [...wsKey(slug), 'time-entries', 'summary', from, to] as const,
};
export const taxRateKeys = resourceKeys('tax-rates');
export const invoiceKeys = resourceKeys('invoices');
export const paymentKeys = resourceKeys('payments');
export const expenseKeys = resourceKeys('expenses');
export const accountKeys = {
  ...resourceKeys('accounts'),
  register: (slug: string, id: string, params: QueryParams = {}) =>
    [...wsKey(slug), 'accounts', 'register', id, params] as const,
};
export const journalKeys = resourceKeys('journal');
export const reportKeys = {
  all: (slug: string) => [...wsKey(slug), 'reports'] as const,
  report: (slug: string, name: string, params: QueryParams = {}) =>
    [...wsKey(slug), 'reports', name, params] as const,
};
export const approvalKeys = {
  all: (slug: string) => [...wsKey(slug), 'approvals'] as const,
  list: (slug: string, status: string) => [...wsKey(slug), 'approvals', status] as const,
};
export const notificationKeys = {
  all: (slug: string) => [...wsKey(slug), 'notifications'] as const,
  list: (slug: string, params: QueryParams = {}) =>
    [...wsKey(slug), 'notifications', 'list', params] as const,
};
