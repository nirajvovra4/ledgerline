import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { wsKey } from './keys';
import { useSlug } from './slug';

/** Invalidate every query under a workspace — used after ledger-affecting actions. */
export function invalidateWorkspace(qc: QueryClient, slug: string): Promise<void> {
  return qc.invalidateQueries({ queryKey: wsKey(slug) });
}

/** Sweep the whole workspace cache (invoices, ledger, dashboard, notifications…). */
export function useInvalidateWorkspace(): () => Promise<void> {
  const qc = useQueryClient();
  const slug = useSlug();
  return useCallback(() => invalidateWorkspace(qc, slug), [qc, slug]);
}
