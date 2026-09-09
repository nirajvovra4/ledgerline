import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientDto,
  ClientInput,
  ClientStatementDto,
  ClientStats,
  InvoiceDto,
  Paginated,
  ProjectDto,
} from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { clientKeys, wsKey } from './keys';
import { useSlug } from './slug';

export interface ClientListParams extends QueryParams {
  q?: string;
  status?: 'active' | 'archived' | 'all';
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ClientDetailResponse {
  client: ClientDto;
  stats: ClientStats;
  projects: ProjectDto[];
  invoices: InvoiceDto[];
}

export function useClients(params: ClientListParams = {}, options: { enabled?: boolean } = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: clientKeys.list(slug, params),
    queryFn: () => api.get<Paginated<ClientDto>>(wsPath(slug, '/clients'), params),
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

/** All active clients, for select boxes. */
export function useClientOptions() {
  return useClients({ status: 'active', pageSize: 200, sort: 'name', dir: 'asc' });
}

export function useClient(id: string | undefined) {
  const slug = useSlug();
  return useQuery({
    queryKey: clientKeys.detail(slug, id ?? ''),
    queryFn: () => api.get<ClientDetailResponse>(wsPath(slug, `/clients/${id}`)),
    enabled: Boolean(id),
  });
}

export function useClientStatement(id: string | undefined, range: { from?: string; to?: string }) {
  const slug = useSlug();
  return useQuery({
    queryKey: clientKeys.sub(slug, id ?? '', 'statement', range),
    queryFn: () => api.get<ClientStatementDto>(wsPath(slug, `/clients/${id}/statement`), range),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
  });
}

export function useCreateClient() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientInput) =>
      api.post<{ client: ClientDto }>(wsPath(slug, '/clients'), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all(slug) }),
  });
}

export function useUpdateClient(id: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ClientInput>) =>
      api.patch<{ client: ClientDto }>(wsPath(slug, `/clients/${id}`), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: clientKeys.all(slug) }),
  });
}

export function useArchiveClient() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ client: ClientDto }>(wsPath(slug, `/clients/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(slug) }),
  });
}
