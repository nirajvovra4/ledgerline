import { useQuery } from '@tanstack/react-query';
import type { MetaDto } from '@ledgerline/shared';
import { api } from './client';
import { metaKeys } from './keys';

export function useMeta() {
  return useQuery({
    queryKey: metaKeys.meta,
    queryFn: () => api.get<MetaDto>('/api/meta'),
    staleTime: 5 * 60 * 1000,
    gcTime: Infinity,
    retry: 1,
  });
}
