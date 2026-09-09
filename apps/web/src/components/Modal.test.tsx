import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Modal } from './Modal';

describe('Modal', () => {
  it('traps focus, closes on Escape and restores focus', async () => {
    const onClose = vi.fn();
    render(
      <>
        <button>outside</button>
        <Modal open onClose={onClose} title="Dialog">
          <input aria-label="first" />
          <button>second</button>
        </Modal>
      </>,
    );
    expect(screen.getByRole('dialog', { name: 'Dialog' })).toBeInTheDocument();
    expect(screen.getByLabelText('first')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'second' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByLabelText('first')).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });
  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={vi.fn()} title="Hidden">
        content
      </Modal>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
