import { cx } from '../lib/cx';

export interface Step {
  key: string;
  label: string;
}

export function Stepper({
  steps,
  current,
  onSelect,
  maxReachable,
}: {
  steps: Step[];
  current: number;
  onSelect?: (index: number) => void;
  maxReachable?: number;
}) {
  return (
    <ol
      className="stepper"
      aria-label="Steps"
      style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}
    >
      {steps.map((s, i) => {
        const reachable = maxReachable == null || i <= maxReachable;
        return (
          <li key={s.key} style={{ display: 'contents' }}>
            <button
              type="button"
              className={cx(
                'stepper__step',
                i === current && 'is-active',
                i < current && 'is-done',
              )}
              aria-current={i === current ? 'step' : undefined}
              disabled={!onSelect || !reachable}
              onClick={() => onSelect?.(i)}
            >
              <span className="stepper__num" aria-hidden="true">
                {i < current ? '✓' : i + 1}
              </span>
              <span>{s.label}</span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
