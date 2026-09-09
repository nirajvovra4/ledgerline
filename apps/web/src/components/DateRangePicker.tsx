import { useState } from 'react';
import type { DateRange, IsoDate } from '@ledgerline/shared';
import { presetForRange, rangeForPreset, RANGE_PRESETS, type RangePreset } from '../lib/dates';
import { DateInput } from './DateInput';
import { Select } from './Select';

export interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  today: IsoDate;
  fiscalYearStartMonth?: number;
  presets?: RangePreset[];
  size?: 'sm' | 'md';
}

/** Preset select + from/to inputs. Presets are computed from the server's today. */
export function DateRangePicker({
  value,
  onChange,
  today,
  fiscalYearStartMonth = 1,
  presets,
  size = 'md',
}: DateRangePickerProps) {
  const options = RANGE_PRESETS.filter((p) => !presets || presets.includes(p.value));
  const derived = presetForRange(value, today, fiscalYearStartMonth);
  const [forcedCustom, setForcedCustom] = useState(false);
  const preset: RangePreset = forcedCustom ? 'custom' : derived;

  const apply = (p: RangePreset) => {
    if (p === 'custom') {
      setForcedCustom(true);
      return;
    }
    setForcedCustom(false);
    const r = rangeForPreset(p, today, fiscalYearStartMonth);
    if (r) onChange(r);
  };

  return (
    <div className="daterange" role="group" aria-label="Date range">
      <Select
        size={size}
        value={preset}
        onChange={(e) => apply(e.target.value as RangePreset)}
        aria-label="Range preset"
        options={options}
      />
      <DateInput
        size={size}
        value={value.from}
        aria-label="From"
        onChange={(from) => from && onChange({ from, to: value.to < from ? from : value.to })}
      />
      <span className="daterange__sep">–</span>
      <DateInput
        size={size}
        value={value.to}
        aria-label="To"
        onChange={(to) => to && onChange({ from: value.from > to ? to : value.from, to })}
      />
    </div>
  );
}
