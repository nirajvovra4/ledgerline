import { useMemo, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import { csvFilename, toCsv, type CsvCell } from '../lib/csv';
import { downloadCsv } from '../lib/download';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';
import { Pagination, type PaginationProps } from './Pagination';
import { SkeletonRows } from './Skeleton';

export type SortDir = 'asc' | 'desc';
export interface SortState {
  key: string;
  dir: SortDir;
}

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T, index: number) => ReactNode;
  /** Right-aligned tabular column (money or counts). */
  align?: 'left' | 'right' | 'center';
  money?: boolean;
  sortable?: boolean;
  /** Value used for client-side sorting when no `onSortChange` is supplied. */
  sortValue?: (row: T) => string | number | null | undefined;
  width?: string;
  wrap?: boolean;
  /** Value for CSV export; defaults to `sortValue` or the rendered text when it is a string. */
  csv?: (row: T) => CsvCell;
  className?: string;
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: unknown;
  onRetry?: () => void;
  empty?: { title: string; description?: string; action?: ReactNode };
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  defaultSort?: SortState;
  onRowClick?: (row: T) => void;
  rowHref?: (row: T) => string | undefined;
  rowClassName?: (row: T) => string | undefined;
  pagination?: PaginationProps;
  footer?: ReactNode;
  caption?: string;
  compact?: boolean;
  flush?: boolean;
  exportName?: string;
  /** Extra toolbar content next to Export CSV. */
  toolbar?: ReactNode;
  selectedKey?: string | null;
}

function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  empty,
  sort: controlledSort,
  onSortChange,
  defaultSort,
  onRowClick,
  rowClassName,
  pagination,
  footer,
  caption,
  compact,
  flush,
  exportName,
  toolbar,
  selectedKey,
}: DataTableProps<T>) {
  const [internalSort, setInternalSort] = useState<SortState | undefined>(defaultSort);
  const sort = controlledSort ?? internalSort;

  const toggleSort = (key: string) => {
    const next: SortState =
      sort?.key === key ? { key, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' };
    if (onSortChange) onSortChange(next);
    else setInternalSort(next);
  };

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    if (onSortChange || !sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const getter = col.sortValue;
    const copy = rows.slice();
    copy.sort((a, b) => {
      const c = compareValues(getter(a), getter(b));
      return sort.dir === 'asc' ? c : -c;
    });
    return copy;
  }, [rows, sort, columns, onSortChange]);

  const exportCsv = () => {
    const headers = columns.map((c) => (typeof c.header === 'string' ? c.header : c.key));
    const data = sortedRows.map((row) =>
      columns.map((c) => {
        if (c.csv) return c.csv(row);
        if (c.sortValue) return c.sortValue(row);
        const rendered = c.render(row, 0);
        return typeof rendered === 'string' || typeof rendered === 'number' ? rendered : '';
      }),
    );
    downloadCsv(csvFilename(exportName ?? 'export'), toCsv(headers, data));
  };

  const colCount = columns.length;
  const showEmpty = !loading && !error && sortedRows.length === 0;

  return (
    <div>
      {exportName || toolbar ? (
        <div className="row row--end" style={{ marginBottom: 8, gap: 8 }}>
          {toolbar}
          {exportName ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={exportCsv}
              disabled={sortedRows.length === 0}
            >
              Export CSV
            </Button>
          ) : null}
        </div>
      ) : null}
      <div className={cx('table-wrap', flush && 'table-wrap--flush')}>
        <table className={cx('table', compact && 'table--compact')}>
          {caption ? <caption className="visually-hidden">{caption}</caption> : null}
          <thead>
            <tr>
              {columns.map((c) => {
                const align = c.align ?? (c.money ? 'right' : 'left');
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    scope="col"
                    className={cx(
                      align === 'right' && 'is-right',
                      align === 'center' && 'is-center',
                      c.money && 'is-money',
                      c.className,
                    )}
                    style={c.width ? { width: c.width } : undefined}
                    aria-sort={
                      active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined
                    }
                  >
                    {c.sortable ? (
                      <button
                        type="button"
                        className={cx('table__sort', active && 'is-active')}
                        onClick={() => toggleSort(c.key)}
                      >
                        {c.header}
                        <span className="table__sort-icon" aria-hidden="true">
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : '△'}
                        </span>
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading && !rows?.length ? (
              <tr>
                <td colSpan={colCount} style={{ padding: 0 }}>
                  <SkeletonRows rows={5} />
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={colCount} style={{ padding: 0 }}>
                  <ErrorState error={error} onRetry={onRetry} compact />
                </td>
              </tr>
            ) : showEmpty ? (
              <tr>
                <td colSpan={colCount} style={{ padding: 0 }}>
                  <EmptyState
                    title={empty?.title ?? 'Nothing here yet'}
                    description={empty?.description}
                    action={empty?.action}
                    flush
                  />
                </td>
              </tr>
            ) : (
              sortedRows.map((row, index) => {
                const key = rowKey(row);
                const clickable = Boolean(onRowClick);
                return (
                  <tr
                    key={key}
                    className={cx(
                      clickable && 'is-clickable',
                      selectedKey === key && 'is-selected',
                      rowClassName?.(row),
                    )}
                    onClick={clickable ? () => onRowClick?.(row) : undefined}
                    onKeyDown={
                      clickable
                        ? (e) => {
                            if (e.key === 'Enter' && e.target === e.currentTarget)
                              onRowClick?.(row);
                          }
                        : undefined
                    }
                    tabIndex={clickable ? 0 : undefined}
                  >
                    {columns.map((c) => {
                      const align = c.align ?? (c.money ? 'right' : 'left');
                      return (
                        <td
                          key={c.key}
                          className={cx(
                            align === 'right' && 'is-right',
                            align === 'center' && 'is-center',
                            c.money && 'is-money',
                            c.wrap && 'is-wrap',
                            c.className,
                          )}
                        >
                          {c.render(row, index)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
          {footer && !showEmpty && !error ? <tfoot>{footer}</tfoot> : null}
        </table>
      </div>
      {pagination && !error ? <Pagination {...pagination} /> : null}
    </div>
  );
}
