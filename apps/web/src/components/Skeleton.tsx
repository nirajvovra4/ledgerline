import { cx } from '../lib/cx';

export function Skeleton({
  width,
  height = 14,
  className,
  style,
}: {
  width?: string | number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={cx('skeleton', className)}
      style={{ width: width ?? '100%', height, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-rows" role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} width={`${70 + ((i * 13) % 30)}%`} />
      ))}
    </div>
  );
}

export function SkeletonBlock({ height = 120 }: { height?: number }) {
  return <Skeleton height={height} />;
}
