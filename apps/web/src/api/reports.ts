import { useQuery } from '@tanstack/react-query';
import type {
  AgingReportDto,
  BalanceSheetDto,
  ProfitLossDto,
  RevenueByClientDto,
  TaxSummaryDto,
  TimeUtilisationDto,
  TrialBalanceDto,
} from '@ledgerline/shared';
import { api, wsPath, type QueryParams } from './client';
import { reportKeys } from './keys';
import { useSlug } from './slug';

function useReport<T>(name: string, params: QueryParams, enabled = true) {
  const slug = useSlug();
  return useQuery({
    queryKey: reportKeys.report(slug, name, params),
    queryFn: () => api.get<T>(wsPath(slug, `/reports/${name}`), params),
    placeholderData: (prev) => prev,
    enabled,
  });
}

export const useProfitLoss = (params: {
  from: string;
  to: string;
  compare?: 'previous' | 'none';
}) => useReport<ProfitLossDto>('profit-loss', params);
export const useBalanceSheet = (asOf: string) =>
  useReport<BalanceSheetDto>('balance-sheet', { asOf });
export const useTrialBalance = (asOf: string) =>
  useReport<TrialBalanceDto>('trial-balance', { asOf });
export const useArAging = (asOf: string) => useReport<AgingReportDto>('ar-aging', { asOf });
export const useTaxSummary = (params: { from: string; to: string }) =>
  useReport<TaxSummaryDto>('tax-summary', params);
export const useRevenueByClient = (params: { from: string; to: string }) =>
  useReport<RevenueByClientDto>('revenue-by-client', params);
export const useTimeUtilisation = (params: { from: string; to: string }) =>
  useReport<TimeUtilisationDto>('time-utilisation', params);
