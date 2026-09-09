import { useState } from 'react';
import { ChartTooltip, niceMax, type TooltipState } from './ChartTooltip';

export interface StackedSeries {
  key: string;
  label: string;
  color: string;
}

export interface StackedDatum {
  label: string;
  values: Record<string, number>;
}

export interface StackedBarChartProps {
  series: StackedSeries[];
  data: StackedDatum[];
  format?: (value: number) => string;
  height?: number;
  /** Render series side by side instead of stacked. */
  grouped?: boolean;
  emptyLabel?: string;
  ariaLabel?: string;
}

const W = 600;

export function StackedBarChart({
  series,
  data,
  format = String,
  height = 200,
  grouped = true,
  emptyLabel = 'No data',
  ariaLabel = 'Chart',
}: StackedBarChartProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const totals = data.map((d) =>
    grouped
      ? Math.max(...series.map((s) => d.values[s.key] ?? 0))
      : series.reduce((sum, s) => sum + (d.values[s.key] ?? 0), 0),
  );
  if (data.length === 0 || totals.every((t) => t === 0))
    return <div className="chart chart--empty">{emptyLabel}</div>;
  const padL = 48;
  const padB = 22;
  const padT = 8;
  const H = height;
  const max = niceMax(Math.max(...totals));
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const slot = innerW / data.length;
  const groupW = Math.min(64, slot * 0.7);
  const barW = grouped ? groupW / series.length : groupW;
  const gridLines = 4;

  return (
    <div className="chart" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ height }}>
        {Array.from({ length: gridLines + 1 }, (_, i) => {
          const y = padT + innerH - (innerH * i) / gridLines;
          return (
            <g key={i}>
              <line className="chart__grid" x1={padL} x2={W - 8} y1={y} y2={y} />
              <text className="chart__axis" x={padL - 6} y={y + 3} textAnchor="end">
                {format((max * i) / gridLines)}
              </text>
            </g>
          );
        })}
        {data.map((d, i) => {
          const gx = padL + slot * i + (slot - groupW) / 2;
          let stackY = padT + innerH;
          const showTip = (y: number) =>
            setTip({
              x: ((gx + groupW / 2) / W) * 100,
              y: (y / H) * 100,
              title: d.label,
              rows: series.map((s) => ({
                label: s.label,
                value: format(d.values[s.key] ?? 0),
                color: s.color,
              })),
            });
          return (
            <g key={d.label + i}>
              {series.map((s, si) => {
                const v = d.values[s.key] ?? 0;
                const h = max === 0 ? 0 : (v / max) * innerH;
                let x: number;
                let y: number;
                if (grouped) {
                  x = gx + barW * si;
                  y = padT + innerH - h;
                } else {
                  x = gx;
                  stackY -= h;
                  y = stackY;
                }
                return (
                  <rect
                    key={s.key}
                    className="chart__bar"
                    x={x + 1}
                    y={y}
                    width={Math.max(1, barW - 2)}
                    height={Math.max(h, v > 0 ? 1 : 0)}
                    fill={s.color}
                    rx={1}
                    onMouseEnter={() => showTip(y)}
                    onMouseLeave={() => setTip(null)}
                  >
                    <title>{`${d.label} — ${s.label}: ${format(v)}`}</title>
                  </rect>
                );
              })}
              <text className="chart__axis" x={gx + groupW / 2} y={H - 6} textAnchor="middle">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip state={tip} />
      <div className="chart__legend">
        {series.map((s) => (
          <span key={s.key} className="chart__legend-item">
            <span className="chart__swatch" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
