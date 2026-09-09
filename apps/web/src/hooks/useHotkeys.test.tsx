import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useHotkeys } from './useHotkeys';

function Harness({ onSlash, onN }: { onSlash: () => void; onN: () => void }) {
  useHotkeys({ '/': onSlash, n: onN });
  return <input aria-label="field" />;
}

describe('useHotkeys', () => {
  it('fires handlers for plain keys but not while typing in a field', async () => {
    const onSlash = vi.fn();
    const onN = vi.fn();
    render(<Harness onSlash={onSlash} onN={onN} />);
    await userEvent.keyboard('n');
    expect(onN).toHaveBeenCalledTimes(1);
    await userEvent.keyboard('/');
    expect(onSlash).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByLabelText('field'));
    await userEvent.keyboard('n');
    expect(onN).toHaveBeenCalledTimes(1);
  });
});
