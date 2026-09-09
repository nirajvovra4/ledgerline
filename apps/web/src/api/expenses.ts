import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ExpenseDetailDto,
  ExpenseDto,
  ExpenseInput,
  ExpenseListSummary,
  Paginated,
  PayExpenseInput,
} from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { invalidateWorkspace } from './invalidate';
import { expenseKeys } from './keys';
import { useSlug } from './slug';

export interface ExpenseListParams extends QueryParams {
  q?: string;
  status?: string;
  accountId?: string;
  clientId?: string;
  projectId?: string;
  from?: string;
  to?: string;
  sort?: string;
  dir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface ExpenseListResponse extends Paginated<ExpenseDto> {
  summary: ExpenseListSummary;
  counts?: Partial<Record<string, number>>;
}

export function useExpenses(params: ExpenseListParams = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: expenseKeys.list(slug, params),
    queryFn: () => api.get<ExpenseListResponse>(wsPath(slug, '/expenses'), params),
    placeholderData: (prev) => prev,
  });
}

export function useExpense(id: string | undefined) {
  const slug = useSlug();
  return useQuery({
    queryKey: expenseKeys.detail(slug, id ?? ''),
    queryFn: () => api.get<ExpenseDetailDto>(wsPath(slug, `/expenses/${id}`)),
    enabled: Boolean(id),
  });
}

function useAfterExpenseChange() {
  const slug = useSlug();
  const qc = useQueryClient();
  return () => invalidateWorkspace(qc, slug);
}

export function useCreateExpense() {
  const slug = useSlug();
  const after = useAfterExpenseChange();
  return useMutation({
    mutationFn: (input: ExpenseInput) =>
      api.post<ExpenseDetailDto>(wsPath(slug, '/expenses'), input),
    onSuccess: after,
  });
}

export function useUpdateExpense(id: string) {
  const slug = useSlug();
  const after = useAfterExpenseChange();
  return useMutation({
    mutationFn: (input: Partial<ExpenseInput>) =>
      api.patch<ExpenseDetailDto>(wsPath(slug, `/expenses/${id}`), input),
    onSuccess: after,
  });
}

export function useDeleteExpense() {
  const slug = useSlug();
  const after = useAfterExpenseChange();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(wsPath(slug, `/expenses/${id}`)),
    onSuccess: after,
  });
}

export type ExpenseTransition = 'submit' | 'approve' | 'reject';

export function useExpenseTransition() {
  const slug = useSlug();
  const after = useAfterExpenseChange();
  return useMutation({
    mutationFn: ({
      id,
      action,
      body,
    }: {
      id: string;
      action: ExpenseTransition;
      body?: { comment?: string };
    }) => api.post<ExpenseDetailDto>(wsPath(slug, `/expenses/${id}/${action}`), body ?? {}),
    onSuccess: after,
  });
}

export function usePayExpense() {
  const slug = useSlug();
  const after = useAfterExpenseChange();
  return useMutation({
    mutationFn: ({ id, ...input }: PayExpenseInput & { id: string }) =>
      api.post<ExpenseDetailDto>(wsPath(slug, `/expenses/${id}/pay`), input),
    onSuccess: after,
  });
}
