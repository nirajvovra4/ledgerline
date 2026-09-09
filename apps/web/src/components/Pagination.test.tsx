import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('collapses long page lists with ellipses around the current page', () => {
    render(<Pagination page={7} pageSize={10} total={200} onPageChange={vi.fn()} />);
    const buttons = screen.getAllByRole('button').map((b) => b.textContent);
    expect(buttons).toEqual(['‹', '1', '6', '7', '8', '20', '›']);
    expect(screen.getAllByText('…')).toHaveLength(2);
    expect(screen.getByRole('button', { name: '7' })).toHaveAttribute('aria-current', 'page');
  });
  it('shows a compact summary when everything fits on one page', () => {
    render(<Pagination page={1} pageSize={25} total={3} onPageChange={vi.fn()} />);
    expect(screen.getByText('3 results')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
