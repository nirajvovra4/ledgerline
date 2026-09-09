import { useState } from 'react';
import { ChartTooltip, niceMax, type TooltipState } from './ChartTooltip';

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
  /** Tooltip text; defaults to `format(value)`. */
  detail?: string;
}

export interface BarChartProps {
  data: BarDatum[];
  format?: (value: number) => string;
  height?: number;
  color?: string;
  emptyLabel?: string;
  ariaLabel?: string;
  gridLines?: number;
}

const W = 600;

export function BarChart({
  data,
  format = String,
  height = 180,
  color = 'var(--blue)',
  emptyLabel = 'No data',
  ariaLabel = 'Bar chart',
  gridLines = 4,
}: BarChartProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  if (data.length === 0 || data.every((d) => d.value === 0))
    return <div className="chart chart--empty">{emptyLabel}</div>;
  const padL = 44;
  const padB = 22;
  const padT = 8;
  const H = height;
  const max = niceMax(Math.max(...data.map((d) => d.value)));
  const innerW = W - padL - 8;
  const innerH = H - padB - padT;
  const slot = innerW / data.length;
  const barW = Math.max(4, Math.min(48, slot * 0.6));

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
          const h = max === 0 ? 0 : (d.value / max) * innerH;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + innerH - h;
          return (
            <g key={d.label + i}>
              <rect
                className="chart__bar"
                x={x}
                y={y}
                width={barW}
                height={Math.max(h, d.value > 0 ? 1 : 0)}
                fill={d.color ?? color}
                rx={1}
                onMouseEnter={() =>
                  setTip({
                    x: ((x + barW / 2) / W) * 100,
                    y: (y / H) * 100,
                    title: d.label,
                    rows: [{ label: d.detail ?? 'Value', value: format(d.value) }],
                  })
                }
                onMouseLeave={() => setTip(null)}
              >
                <title>{`${d.label}: ${format(d.value)}`}</title>
              </rect>
              {data.length <= 16 || i % Math.ceil(data.length / 16) === 0 ? (
                <text className="chart__axis" x={x + barW / 2} y={H - 6} textAnchor="middle">
                  {d.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <ChartTooltip state={tip} />
    </div>
  );
}
