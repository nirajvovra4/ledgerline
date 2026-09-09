import { useState } from 'react';
import { SERIES_PALETTE } from './ChartTooltip';

export interface DonutSlice {
  key: string;
  label: string;
  value: number;
  color?: string;
  sub?: string;
}

export interface DonutChartProps {
  slices: DonutSlice[];
  format?: (value: number) => string;
  size?: number;
  centerLabel?: string;
  centerValue?: string;
  emptyLabel?: string;
  ariaLabel?: string;
}

export function DonutChart({
  slices,
  format = String,
  size = 150,
  centerLabel,
  centerValue,
  emptyLabel = 'Nothing outstanding',
  ariaLabel = 'Donut chart',
}: DonutChartProps) {
  const [hover, setHover] = useState<string | null>(null);
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  if (total <= 0) return <div className="chart chart--empty">{emptyLabel}</div>;
  const r = 42;
  const stroke = 14;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const active = slices.find((s) => s.key === hover);

  return (
    <div className="donut" role="img" aria-label={ariaLabel}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        {slices.map((s, i) => {
          const frac = Math.max(0, s.value) / total;
          const len = frac * c;
          const el = (
            <circle
              key={s.key}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length]}
              strokeWidth={hover === s.key ? stroke + 3 : stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 50 50)"
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              style={{ transition: 'stroke-width 120ms' }}
            >
              <title>{`${s.label}: ${format(s.value)}`}</title>
            </circle>
          );
          offset += len;
          return el;
        })}
        <text x="50" y="47" textAnchor="middle" className="donut__center" fontSize="11">
          {active ? active.label : (centerLabel ?? 'Total')}
        </text>
        <text
          x="50"
          y="60"
          textAnchor="middle"
          className="donut__center"
          fontSize="9"
          fill="var(--ink-muted)"
        >
          {active ? format(active.value) : (centerValue ?? format(total))}
        </text>
      </svg>
      <ul className="donut__legend list-plain">
        {slices.map((s, i) => (
          <li
            key={s.key}
            className="donut__row"
            onMouseEnter={() => setHover(s.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="chart__swatch"
              style={{ background: s.color ?? SERIES_PALETTE[i % SERIES_PALETTE.length] }}
            />
            <span className="truncate">
              {s.label}
              {s.sub ? <span className="muted tiny"> · {s.sub}</span> : null}
            </span>
            <span className="num">{format(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
