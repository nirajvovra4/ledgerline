import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DateRangePicker } from './DateRangePicker';

const today = '2026-06-30';

describe('DateRangePicker', () => {
  it('applies presets computed from the given today', async () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: '2026-06-01', to: '2026-06-30' }}
        onChange={onChange}
        today={today}
        fiscalYearStartMonth={4}
      />,
    );
    const select = screen.getByLabelText('Range preset');
    expect(select).toHaveValue('this_month');
    await userEvent.selectOptions(select, 'last_month');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-05-01', to: '2026-05-31' });
    await userEvent.selectOptions(select, 'this_quarter');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-04-01', to: '2026-06-30' });
    await userEvent.selectOptions(select, 'this_year');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-01-01', to: '2026-12-31' });
    await userEvent.selectOptions(select, 'fiscal_year');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-04-01', to: '2027-03-31' });
  });

  it('shows "custom" for a range matching no preset and keeps from <= to', async () => {
    const onChange = vi.fn();
    render(
      <DateRangePicker
        value={{ from: '2026-06-03', to: '2026-06-20' }}
        onChange={onChange}
        today={today}
      />,
    );
    expect(screen.getByLabelText('Range preset')).toHaveValue('custom');
    fireEvent.change(screen.getByLabelText('To'), { target: { value: '2026-05-01' } });
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-05-01', to: '2026-05-01' });
  });
});
