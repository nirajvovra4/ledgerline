import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Paginated,
  ProjectDto,
  ProjectInput,
  ProjectStats,
  TimeEntryDto,
} from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { projectKeys, wsKey } from './keys';
import { useSlug } from './slug';

export interface ProjectListParams extends QueryParams {
  q?: string;
  status?: 'active' | 'on_hold' | 'completed' | 'archived' | 'all';
  clientId?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ProjectDetailResponse {
  project: ProjectDto;
  stats: ProjectStats;
  recentEntries: TimeEntryDto[];
}

export function useProjects(params: ProjectListParams = {}, options: { enabled?: boolean } = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: projectKeys.list(slug, params),
    queryFn: () => api.get<Paginated<ProjectDto>>(wsPath(slug, '/projects'), params),
    placeholderData: (prev) => prev,
    enabled: options.enabled ?? true,
  });
}

/** Active projects for select boxes, optionally narrowed to a client. */
export function useProjectOptions(clientId?: string) {
  return useProjects({
    status: 'active',
    clientId: clientId || undefined,
    pageSize: 200,
    sort: 'name',
    dir: 'asc',
  });
}

export function useProject(id: string | undefined) {
  const slug = useSlug();
  return useQuery({
    queryKey: projectKeys.detail(slug, id ?? ''),
    queryFn: () => api.get<ProjectDetailResponse>(wsPath(slug, `/projects/${id}`)),
    enabled: Boolean(id),
  });
}

export function useCreateProject() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      api.post<{ project: ProjectDto }>(wsPath(slug, '/projects'), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(slug) }),
  });
}

export function useUpdateProject(id: string) {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<ProjectInput>) =>
      api.patch<{ project: ProjectDto }>(wsPath(slug, `/projects/${id}`), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(slug) }),
  });
}

export function useArchiveProject() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ project: ProjectDto }>(wsPath(slug, `/projects/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(slug) }),
  });
}
