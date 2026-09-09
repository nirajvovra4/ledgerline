import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { JournalEntryDto, ManualJournalEntryInput, Paginated } from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { invalidateWorkspace } from './invalidate';
import { journalKeys } from './keys';
import { useSlug } from './slug';

export interface JournalListParams extends QueryParams {
  from?: string;
  to?: string;
  accountId?: string;
  sourceType?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function useJournal(params: JournalListParams = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: journalKeys.list(slug, params),
    queryFn: () => api.get<Paginated<JournalEntryDto>>(wsPath(slug, '/journal'), params),
    placeholderData: (prev) => prev,
  });
}

export function useJournalEntry(id: string | undefined) {
  const slug = useSlug();
  return useQuery({
    queryKey: journalKeys.detail(slug, id ?? ''),
    queryFn: () => api.get<{ entry: JournalEntryDto }>(wsPath(slug, `/journal/${id}`)),
    select: (d) => d.entry,
    enabled: Boolean(id),
  });
}

export function useCreateJournalEntry() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ManualJournalEntryInput) =>
      api.post<{ entry: JournalEntryDto }>(wsPath(slug, '/journal'), input),
    onSuccess: () => invalidateWorkspace(qc, slug),
  });
}

export function useReverseJournalEntry() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; date?: string; memo?: string }) =>
      api.post<{ entry: JournalEntryDto }>(wsPath(slug, `/journal/${id}/reverse`), body),
    onSuccess: () => invalidateWorkspace(qc, slug),
  });
}
