import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AccountDto, AccountInput, AccountNode, AccountRegisterDto } from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { accountKeys, wsKey } from './keys';
import { useSlug } from './slug';

export interface AccountsResponse {
  items: AccountDto[];
  tree: AccountNode[];
}

export function useAccounts(includeArchived = false) {
  const slug = useSlug();
  return useQuery({
    queryKey: accountKeys.list(slug, { includeArchived }),
    queryFn: () =>
      api.get<AccountsResponse>(wsPath(slug, '/accounts'), {
        includeArchived: includeArchived || undefined,
      }),
    staleTime: 60 * 1000,
  });
}

export interface RegisterParams extends QueryParams {
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function useAccountRegister(id: string | undefined, params: RegisterParams) {
  const slug = useSlug();
  return useQuery({
    queryKey: accountKeys.register(slug, id ?? '', params),
    queryFn: () => api.get<AccountRegisterDto>(wsPath(slug, `/accounts/${id}/register`), params),
    enabled: Boolean(id),
    placeholderData: (prev) => prev,
  });
}

export function useCreateAccount() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AccountInput) =>
      api.post<{ account: AccountDto }>(wsPath(slug, '/accounts'), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: accountKeys.all(slug) }),
  });
}

export function useUpdateAccount() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<AccountInput> & { id: string }) =>
      api.patch<{ account: AccountDto }>(wsPath(slug, `/accounts/${id}`), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: wsKey(slug) }),
  });
}
