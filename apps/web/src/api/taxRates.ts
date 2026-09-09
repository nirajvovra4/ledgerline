import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TaxRateDto, TaxRateInput } from '@ledgerline/shared';
import { api, wsPath } from './client';
import { taxRateKeys } from './keys';
import { useSlug } from './slug';

export function useTaxRates() {
  const slug = useSlug();
  return useQuery({
    queryKey: taxRateKeys.all(slug),
    queryFn: () => api.get<{ items: TaxRateDto[] }>(wsPath(slug, '/tax-rates')),
    select: (d) => d.items,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTaxRate() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaxRateInput) =>
      api.post<{ taxRate: TaxRateDto }>(wsPath(slug, '/tax-rates'), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxRateKeys.all(slug) }),
  });
}

export function useUpdateTaxRate() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: Partial<TaxRateInput> & { id: string; archived?: boolean }) =>
      api.patch<{ taxRate: TaxRateDto }>(wsPath(slug, `/tax-rates/${id}`), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxRateKeys.all(slug) }),
  });
}

export function useArchiveTaxRate() {
  const slug = useSlug();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ taxRate: TaxRateDto }>(wsPath(slug, `/tax-rates/${id}`)),
    onSuccess: () => qc.invalidateQueries({ queryKey: taxRateKeys.all(slug) }),
  });
}
