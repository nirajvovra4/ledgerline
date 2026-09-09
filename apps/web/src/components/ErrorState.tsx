import { errorMessage, isApiError } from '../api/client';
import { cx } from '../lib/cx';
import { Button } from './Button';

export function ErrorState({
  error,
  onRetry,
  title,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}) {
  const heading =
    title ??
    (isApiError(error) && error.isNotFound
      ? 'Not found'
      : isApiError(error) && error.status === 403
        ? 'No access'
        : 'Something went wrong');
  return (
    <div className={cx('error-state', compact && 'error-state--compact')} role="alert">
      <div className="error-state__title">{heading}</div>
      <div className="small">{errorMessage(error)}</div>
      {onRetry ? (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
