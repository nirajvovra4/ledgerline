import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DurationInput } from './DurationInput';

function Harness({ onChange }: { onChange: (v: number | null) => void }) {
  const [value, setValue] = useState<number | null>(null);
  return (
    <DurationInput
      aria-label="Duration"
      value={value}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('DurationInput', () => {
  it.each([
    ['1h 30m', 90],
    ['1:30', 90],
    ['90m', 90],
    ['1.5', 90],
    ['2', 120],
    ['0:45', 45],
  ])('parses %s into %i minutes', async (text, minutes) => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('Duration'), text);
    expect(onChange).toHaveBeenLastCalledWith(minutes);
  });

  it('normalises to "1h 30m" on blur', async () => {
    render(<Harness onChange={vi.fn()} />);
    const input = screen.getByLabelText('Duration');
    await userEvent.type(input, '1:30');
    await userEvent.tab();
    expect(input).toHaveValue('1h 30m');
  });

  it('flags unparseable text as invalid and reports null', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Duration');
    await userEvent.type(input, '1:75');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });
});
