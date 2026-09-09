import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ExpenseStamp, InvoiceStamp, ProjectStamp, StatusStamp } from './StatusStamp';

describe('StatusStamp', () => {
  it('renders invoice labels and tones from the shared constants', () => {
    const { rerender } = render(<InvoiceStamp status="overdue" />);
    const el = screen.getByText('Overdue');
    expect(el).toHaveClass('stamp', 'stamp--negative');
    rerender(<InvoiceStamp status="pending_approval" />);
    expect(screen.getByText('Pending approval')).toHaveClass('stamp--warning');
    rerender(<InvoiceStamp status="paid" />);
    expect(screen.getByText('Paid')).toHaveClass('stamp--positive');
    rerender(<InvoiceStamp status="void" />);
    expect(screen.getByText('Void')).toHaveClass('stamp--muted');
  });

  it('renders expense and project stamps', () => {
    render(
      <>
        <ExpenseStamp status="rejected" />
        <ProjectStamp status="on_hold" />
      </>,
    );
    expect(screen.getByText('Rejected')).toHaveClass('stamp--negative');
    expect(screen.getByText('On hold')).toHaveClass('stamp--warning');
  });

  it('supports the large size and custom labels', () => {
    render(<StatusStamp label="Custom" tone="info" size="lg" />);
    expect(screen.getByText('Custom')).toHaveClass('stamp--info', 'stamp--lg');
  });
});
