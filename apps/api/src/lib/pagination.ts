import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, type Paginated } from '@ledgerline/shared';

export interface PageInput {
  page?: number;
  pageSize?: number;
}

export interface SortInput {
  sort?: string;
  dir?: 'asc' | 'desc';
}

export interface ResolvedPage {
  page: number;
  pageSize: number;
  offset: number;
}

export function resolvePage(input: PageInput): ResolvedPage {
  const page = Math.max(1, Math.trunc(input.page ?? 1));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Math.trunc(input.pageSize ?? DEFAULT_PAGE_SIZE)),
  );
  return { page, pageSize, offset: (page - 1) * pageSize };
}

export function paginated<T>(items: T[], total: number, page: ResolvedPage): Paginated<T> {
  return { items, total, page: page.page, pageSize: page.pageSize };
}

/** One sort column: `[column reference, default direction]`. */
export type SortSpec = Array<[column: string, direction: 'asc' | 'desc']>;

/**
 * Resolve a `?sort=&dir=` pair against a whitelist. Each whitelist entry maps the public sort key
 * to one or more ORDER BY terms; a tie-breaker is appended so pagination is stable.
 */
export function resolveSort(
  input: SortInput,
  whitelist: Record<string, SortSpec>,
  fallback: string,
  tieBreaker: [string, 'asc' | 'desc'],
): SortSpec {
  const key = input.sort && input.sort in whitelist ? input.sort : fallback;
  const spec = whitelist[key] ?? [];
  const terms: SortSpec = spec.map(([col, dir]) => [col, input.dir ?? dir]);
  if (!terms.some(([col]) => col === tieBreaker[0])) terms.push(tieBreaker);
  return terms;
}

/** Slice an already-materialised list (used where the query cannot express the ordering). */
export function sliceForPage<T>(items: T[], page: ResolvedPage): T[] {
  return items.slice(page.offset, page.offset + page.pageSize);
}

/** Escape LIKE wildcards in user input and wrap for a contains match. */
export function likeContains(q: string): string {
  return `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}
