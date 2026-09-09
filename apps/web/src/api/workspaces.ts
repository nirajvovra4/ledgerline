import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ActivityDto,
  CalendarEvent,
  CreateWorkspaceInput,
  DashboardDto,
  DashboardRange,
  InviteDto,
  InviteMemberInput,
  MemberDto,
  Role,
  SearchResultsDto,
  UpdateWorkspaceInput,
  WorkspaceDto,
  WorkspaceSummary,
} from '@ledgerline/shared';
import { api, wsPath } from './client';
import { authKeys, workspaceKeys } from './keys';
import { useSlug } from './slug';

export interface WorkspaceResponse {
  workspace: WorkspaceDto;
  role: Role;
}

export function useWorkspaces(enabled = true) {
  return useQuery({
    queryKey: workspaceKeys.list,
    queryFn: () => api.get<{ items: WorkspaceSummary[] }>('/api/workspaces'),
    enabled,
    select: (d) => d.items,
  });
}

export function useCreateWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkspaceInput) =>
      api.post<{ workspace: WorkspaceDto }>('/api/workspaces', input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: workspaceKeys.list }),
        qc.invalidateQueries({ queryKey: authKeys.me }),
      ]);
    },
  });
}

export function useWorkspaceQuery(slug: string) {
  return useQuery({
    queryKey: workspaceKeys.detail(slug),
    queryFn: () => api.get<WorkspaceResponse>(wsPath(slug)),
    enabled: slug.length > 0,
    staleTime: 60 * 1000,
    retry: (count, err) =>
      !(
        err instanceof Error &&
        'status' in err &&
        [401, 403, 404].includes((err as { status: number }).status)
      ) && count < 2,
  });
}

export function useUpdateWorkspace() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateWorkspaceInput) =>
      api.patch<{ workspace: WorkspaceDto }>(wsPath(slug), input),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: workspaceKeys.detail(slug) }),
        qc.invalidateQueries({ queryKey: workspaceKeys.list }),
        qc.invalidateQueries({ queryKey: authKeys.me }),
      ]);
    },
  });
}

export interface MembersResponse {
  items: MemberDto[];
  invites: InviteDto[];
}

export function useMembers() {
  const slug = useSlug();
  return useQuery({
    queryKey: workspaceKeys.members(slug),
    queryFn: () => api.get<MembersResponse>(wsPath(slug, '/members')),
  });
}

export function useInviteMember() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InviteMemberInput) =>
      api.post<{ invite: InviteDto }>(wsPath(slug, '/members/invite'), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useUpdateMemberRole() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: Role }) =>
      api.patch<{ member: MemberDto }>(wsPath(slug, `/members/${userId}`), { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useRemoveMember() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.delete<{ ok: true }>(wsPath(slug, `/members/${userId}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useRevokeInvite() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api.delete<{ ok: true }>(wsPath(slug, `/invites/${inviteId}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.members(slug) }),
  });
}

export function useDashboard(range: DashboardRange) {
  const slug = useSlug();
  return useQuery({
    queryKey: workspaceKeys.dashboard(slug, range),
    queryFn: () => api.get<DashboardDto>(wsPath(slug, '/dashboard'), { range }),
  });
}

export function useActivity(params: { limit?: number; before?: string } = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: workspaceKeys.activity(slug, params),
    queryFn: () => api.get<{ items: ActivityDto[] }>(wsPath(slug, '/activity'), params),
    select: (d) => d.items,
  });
}

export function useSearch(q: string) {
  const slug = useSlug();
  const trimmed = q.trim();
  return useQuery({
    queryKey: workspaceKeys.search(slug, trimmed),
    queryFn: ({ signal }) =>
      api.get<SearchResultsDto>(wsPath(slug, '/search'), { q: trimmed }, signal),
    enabled: trimmed.length >= 2,
    staleTime: 30 * 1000,
    placeholderData: (prev) => prev,
  });
}

export function useCalendar(month: string) {
  const slug = useSlug();
  return useQuery({
    queryKey: workspaceKeys.calendar(slug, month),
    queryFn: () =>
      api.get<{ month: string; events: CalendarEvent[] }>(wsPath(slug, '/calendar'), { month }),
    select: (d) => d.events,
    placeholderData: (prev) => prev,
  });
}
