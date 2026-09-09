import { describe, expect, it } from 'vitest';
import { presetForRange, rangeForPreset } from './dates';

const today = '2026-06-30';

describe('rangeForPreset', () => {
  it('computes calendar presets from a fixed today', () => {
    expect(rangeForPreset('this_month', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(rangeForPreset('last_month', today)).toEqual({ from: '2026-05-01', to: '2026-05-31' });
    expect(rangeForPreset('this_quarter', today)).toEqual({ from: '2026-04-01', to: '2026-06-30' });
    expect(rangeForPreset('this_year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
    expect(rangeForPreset('last_30', today)).toEqual({ from: '2026-06-01', to: '2026-06-30' });
    expect(rangeForPreset('custom', today)).toBeNull();
  });
  it('honours the fiscal year start month', () => {
    expect(rangeForPreset('fiscal_year', today, 4)).toEqual({
      from: '2026-04-01',
      to: '2027-03-31',
    });
    expect(rangeForPreset('fiscal_year', '2026-02-10', 4)).toEqual({
      from: '2025-04-01',
      to: '2026-03-31',
    });
  });
  it('recognises the preset for a range', () => {
    expect(presetForRange({ from: '2026-06-01', to: '2026-06-30' }, today)).toBe('this_month');
    expect(presetForRange({ from: '2026-06-02', to: '2026-06-30' }, today)).toBe('custom');
  });
});
