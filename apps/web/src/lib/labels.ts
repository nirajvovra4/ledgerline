import { formatBp, type TaxRateDto } from '@ledgerline/shared';

/** "VAT (20%)" — unless the rate name already spells out the percentage ("VAT 20%"). */
export function taxRateLabel(rate: Pick<TaxRateDto, 'name' | 'rateBp'>): string {
  return rate.name.includes('%') ? rate.name : `${rate.name} (${formatBp(rate.rateBp)})`;
}

export const ACCOUNT_TYPE_PLURALS: Record<string, string> = {
  asset: 'Assets',
  liability: 'Liabilities',
  equity: 'Equity',
  revenue: 'Revenue',
  expense: 'Expenses',
};
