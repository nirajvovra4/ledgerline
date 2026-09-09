export interface SparklineProps {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  ariaLabel?: string;
}

/** Minimal inline trend line for tiles and table cells. */
export function Sparkline({
  values,
  width = 90,
  height = 24,
  color = 'var(--blue)',
  fill = true,
  ariaLabel = 'Trend',
}: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map(
    (v, i) => [i * step, height - 2 - ((v - min) / range) * (height - 4)] as const,
  );
  const d = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const last = pts[pts.length - 1]!;
  return (
    <svg
      className="sparkline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
    >
      {fill ? (
        <path d={`${d} L${width},${height} L0,${height} Z`} fill={color} opacity={0.12} />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2} fill={color} />
    </svg>
  );
}
