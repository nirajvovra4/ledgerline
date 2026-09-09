import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated, TimeEntryDto, TimeEntryInput, TimeSummaryDto } from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { projectKeys, timeKeys, workspaceKeys } from './keys';
import { useSlug } from './slug';

export interface TimeEntryListParams extends QueryParams {
  projectId?: string;
  clientId?: string;
  userId?: string;
  from?: string;
  to?: string;
  billable?: boolean;
  uninvoiced?: boolean;
  page?: number;
  pageSize?: number;
}

export function useTimeEntries(
  params: TimeEntryListParams = {},
  options: { enabled?: boolean } = {},
) {
  const slug = useSlug();
  return useQuery({
    queryKey: timeKeys.list(slug, params),
    queryFn: () => api.get<Paginated<TimeEntryDto>>(wsPath(slug, '/time-entries'), params),
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

export function useTimeSummary(from: string, to: string) {
  const slug = useSlug();
  return useQuery({
    queryKey: timeKeys.summary(slug, from, to),
    queryFn: () => api.get<TimeSummaryDto>(wsPath(slug, '/time-entries/summary'), { from, to }),
    placeholderData: (prev) => prev,
  });
}

function useAfterTimeChange() {
  const slug = useSlug();
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: timeKeys.all(slug) }),
      qc.invalidateQueries({ queryKey: projectKeys.all(slug) }),
      qc.invalidateQueries({ queryKey: workspaceKeys.dashboard(slug, 'month') }),
    ]);
}

export function useCreateTimeEntry() {
  const slug = useSlug();
  const after = useAfterTimeChange();
  return useMutation({
    mutationFn: (input: TimeEntryInput) =>
      api.post<{ entry: TimeEntryDto }>(wsPath(slug, '/time-entries'), input),
    onSuccess: after,
  });
}

export function useUpdateTimeEntry() {
  const slug = useSlug();
  const after = useAfterTimeChange();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TimeEntryInput> & { id: string }) =>
      api.patch<{ entry: TimeEntryDto }>(wsPath(slug, `/time-entries/${id}`), input),
    onSuccess: after,
  });
}

export function useDeleteTimeEntry() {
  const slug = useSlug();
  const after = useAfterTimeChange();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(wsPath(slug, `/time-entries/${id}`)),
    onSuccess: after,
  });
}
