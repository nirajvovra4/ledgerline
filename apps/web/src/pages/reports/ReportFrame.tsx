import type { ReactNode } from 'react';
import { formatDate, formatDateRange, type DateRange } from '@ledgerline/shared';
import { Button } from '../../components/Button';
import { DateInput } from '../../components/DateInput';
import { DateRangePicker } from '../../components/DateRangePicker';
import { ErrorState } from '../../components/ErrorState';
import { IconPrint } from '../../components/Icons';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { useQueryParams } from '../../hooks/useQueryParams';
import { useToday } from '../../hooks/useToday';
import { useWorkspace } from '../../hooks/useWorkspace';
import { rangeForPreset, type RangePreset } from '../../lib/dates';
import { printPage } from '../../lib/print';

const RANGE_DEFAULTS = { from: '', to: '' };
const ASOF_DEFAULTS = { asOf: '' };

/** URL-backed date range for period reports (defaults to a preset computed from server today). */
export function useReportRange(
  defaultPreset: RangePreset = 'this_year',
): [DateRange, (r: DateRange) => void] {
  const today = useToday();
  const { settings } = useWorkspace();
  const [params, setParams] = useQueryParams(RANGE_DEFAULTS);
  const fallback = rangeForPreset(defaultPreset, today, settings.fiscalYearStartMonth)!;
  const range = { from: params.from || fallback.from, to: params.to || fallback.to };
  return [range, (r) => setParams({ from: r.from, to: r.to })];
}

export function useReportAsOf(): [string, (d: string) => void] {
  const today = useToday();
  const [params, setParams] = useQueryParams(ASOF_DEFAULTS);
  return [params.asOf || today, (asOf) => setParams({ asOf })];
}

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

export interface ReportFrameProps<T> {
  title: string;
  description?: string;
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  range?: { value: DateRange; onChange: (r: DateRange) => void };
  asOf?: { value: string; onChange: (d: string) => void };
  extraControls?: ReactNode;
}

export function ReportFrame<T>({
  title,
  description,
  query,
  children,
  range,
  asOf,
  extraControls,
}: ReportFrameProps<T>) {
  const today = useToday();
  const { base, settings, workspace } = useWorkspace();
  const period = range
    ? formatDateRange(range.value)
    : asOf
      ? `as of ${formatDate(asOf.value)}`
      : '';
  return (
    <>
      <PageHeader
        title={title}
        subtitle={description}
        crumbs={[{ label: 'Reports', to: `${base}/reports` }, { label: title }]}
        actions={
          <div className="row row--wrap no-print">
            {range ? (
              <DateRangePicker
                value={range.value}
                onChange={range.onChange}
                today={today}
                fiscalYearStartMonth={settings.fiscalYearStartMonth}
                size="sm"
              />
            ) : null}
            {asOf ? (
              <label className="row small">
                <span className="muted">As of</span>
                <DateInput
                  size="sm"
                  value={asOf.value}
                  onChange={(v) => v && asOf.onChange(v)}
                  aria-label="As of date"
                />
              </label>
            ) : null}
            {extraControls}
          </div>
        }
        primary={
          <Button icon={<IconPrint />} onClick={printPage}>
            Print
          </Button>
        }
      />
      {query.isLoading ? (
        <SkeletonRows rows={10} />
      ) : query.error ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className="statement">
          <div className="statement__head">
            <div className="statement__ws">{workspace.name}</div>
            <div className="statement__title">{title}</div>
            <div className="statement__period">{period}</div>
          </div>
          {children(query.data)}
        </div>
      ) : null}
    </>
  );
}
