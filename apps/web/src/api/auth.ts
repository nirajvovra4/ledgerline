import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UpdateProfileInput,
  UserDto,
  WorkspaceSummary,
} from '@ledgerline/shared';
import { api, isApiError } from './client';
import { authKeys, workspaceKeys } from './keys';

export interface MeResponse {
  user: UserDto;
  workspaces: WorkspaceSummary[];
}

/** Current session; resolves to null (not an error) when signed out. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async (): Promise<MeResponse | null> => {
      try {
        return await api.get<MeResponse>('/api/auth/me');
      } catch (err) {
        if (isApiError(err) && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60 * 1000,
    retry: false,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api.post<{ user: UserDto }>('/api/auth/login', input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: RegisterInput) => api.post<{ user: UserDto }>('/api/auth/register', input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ ok: true }>('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(authKeys.me, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'meta' && q.queryKey[0] !== 'auth' });
    },
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.patch<{ user: UserDto }>('/api/auth/me', input),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: ChangePasswordInput) => api.post<{ ok: true }>('/api/auth/password', input),
  });
}

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) =>
      api.post<{ workspace: WorkspaceSummary }>(`/api/invites/${encodeURIComponent(token)}/accept`),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: authKeys.me }),
        qc.invalidateQueries({ queryKey: workspaceKeys.list }),
      ]);
    },
  });
}
