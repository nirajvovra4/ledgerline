import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Paginated, PaymentDto } from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { invalidateWorkspace } from './invalidate';
import { paymentKeys } from './keys';
import { useSlug } from './slug';

export interface PaymentListParams extends QueryParams {
  clientId?: string;
  method?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function usePayments(params: PaymentListParams = {}) {
  const slug = useSlug();
  return useQuery({
    queryKey: paymentKeys.list(slug, params),
    queryFn: () => api.get<Paginated<PaymentDto>>(wsPath(slug, '/payments'), params),
    placeholderData: (prev) => prev,
  });
}

export function useDeletePayment() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ ok: true }>(wsPath(slug, `/payments/${id}`)),
    onSuccess: () => invalidateWorkspace(qc, slug),
  });
}
