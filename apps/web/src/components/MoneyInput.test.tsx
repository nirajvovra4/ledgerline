import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { MoneyInput } from './MoneyInput';

function Harness({
  onChange,
  allowNegative = true,
  currency = 'USD',
  initial = null,
}: {
  onChange: (v: number | null) => void;
  allowNegative?: boolean;
  currency?: string;
  initial?: number | null;
}) {
  const [value, setValue] = useState<number | null>(initial);
  return (
    <MoneyInput
      aria-label="Amount"
      currency={currency}
      value={value}
      allowNegative={allowNegative}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

describe('MoneyInput', () => {
  it('parses "1,250.5" as 125050 cents', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '1,250.5');
    expect(onChange).toHaveBeenLastCalledWith(125050);
    await userEvent.tab();
    expect(input).toHaveValue('1250.50');
  });

  it('handles negative amounts and parentheses', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, '-12');
    expect(onChange).toHaveBeenLastCalledWith(-1200);
    await userEvent.clear(input);
    await userEvent.type(input, '(7.25)');
    expect(onChange).toHaveBeenLastCalledWith(-725);
  });

  it('coerces negatives to positive when allowNegative is false', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} allowNegative={false} />);
    await userEvent.type(screen.getByLabelText('Amount'), '-40');
    expect(onChange).toHaveBeenLastCalledWith(4000);
  });

  it('reports null and marks invalid input', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText('Amount');
    await userEvent.type(input, 'abc');
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveClass('input--invalid');
  });

  it('formats an initial value using the currency decimals and shows the symbol', () => {
    render(<Harness onChange={vi.fn()} initial={123456} currency="JPY" />);
    expect(screen.getByLabelText('Amount')).toHaveValue('123456');
    expect(screen.getByText('¥')).toBeInTheDocument();
  });
});
