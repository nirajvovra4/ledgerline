import type { ReactNode } from 'react';

export interface TooltipState {
  x: number;
  y: number;
  title: ReactNode;
  rows: Array<{ label: ReactNode; value: ReactNode; color?: string }>;
}

/** Positioned relative to the `.chart` container (percentages of the SVG viewBox). */
export function ChartTooltip({ state }: { state: TooltipState | null }) {
  if (!state) return null;
  return (
    <div
      className="chart__tooltip"
      role="tooltip"
      style={{ left: `${state.x}%`, top: `${state.y}%` }}
    >
      <div className="chart__tooltip-title">{state.title}</div>
      {state.rows.map((r, i) => (
        <div key={i} className="row" style={{ gap: 6 }}>
          {r.color ? <span className="chart__swatch" style={{ background: r.color }} /> : null}
          <span>{r.label}</span>
          <span style={{ marginLeft: 'auto', fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export function niceMax(value: number): number {
  if (value <= 0) return 1;
  const exp = Math.floor(Math.log10(value));
  const base = 10 ** exp;
  const n = value / base;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * base;
}

export const CHART_COLORS = {
  blue: 'var(--blue)',
  red: 'var(--red)',
  moss: 'var(--moss)',
  amber: 'var(--amber)',
  grey: 'var(--grey)',
};

export const SERIES_PALETTE = [
  'var(--blue)',
  'var(--moss)',
  'var(--amber)',
  'var(--red)',
  'var(--grey)',
  '#6c5b9c',
  '#2e8b8b',
];
