import type { ReactNode } from 'react';
import { ErrorState } from './ErrorState';
import { SkeletonRows } from './Skeleton';

interface QueryLike<T> {
  data: T | undefined;
  isLoading: boolean;
  error: unknown;
  refetch: () => unknown;
}

/** Renders loading / error / populated for a TanStack query with one call. */
export function QueryState<T>({
  query,
  children,
  loading,
  rows = 4,
}: {
  query: QueryLike<T>;
  children: (data: T) => ReactNode;
  loading?: ReactNode;
  rows?: number;
}) {
  if (query.isLoading) return <>{loading ?? <SkeletonRows rows={rows} />}</>;
  if (query.error) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === undefined) return null;
  return <>{children(query.data)}</>;
}
