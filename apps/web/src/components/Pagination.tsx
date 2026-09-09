import { Button } from './Button';

export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizes?: number[];
}

function pageWindow(page: number, pageCount: number): Array<number | '…'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const sorted = [...pages].filter((p) => p >= 1 && p <= pageCount).sort((a, b) => a - b);
  const out: Array<number | '…'> = [];
  let prev = 0;
  for (const p of sorted) {
    if (p - prev > 1) out.push('…');
    out.push(p);
    prev = p;
  }
  return out;
}

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  pageSizes = [10, 25, 50, 100],
}: PaginationProps) {
  const pageCount = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  if (total <= pageSize && !onPageSizeChange) {
    return (
      <nav className="pagination" aria-label="Pagination">
        <span>{total === 0 ? 'No results' : `${total} result${total === 1 ? '' : 's'}`}</span>
      </nav>
    );
  }
  return (
    <nav className="pagination" aria-label="Pagination">
      <span>{total === 0 ? 'No results' : `Showing ${from}–${to} of ${total}`}</span>
      <div className="row">
        {onPageSizeChange ? (
          <label className="row small">
            <span className="muted">Rows</span>
            <select
              className="select select--sm"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              aria-label="Rows per page"
            >
              {pageSizes.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <div className="pagination__pages">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
          >
            ‹
          </Button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === '…' ? (
              <span key={`gap-${i}`} className="pagination__page" aria-hidden="true">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                className={`pagination__page${p === page ? ' is-current' : ''}`}
                aria-current={p === page ? 'page' : undefined}
                onClick={() => onPageChange(p)}
              >
                {p}
              </button>
            ),
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
          >
            ›
          </Button>
        </div>
      </div>
    </nav>
  );
}
