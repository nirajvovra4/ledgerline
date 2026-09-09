import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type Column } from './DataTable';

interface Row {
  id: string;
  name: string;
  amount: number;
}

const rows: Row[] = [
  { id: '1', name: 'Charlie', amount: 300 },
  { id: '2', name: 'alpha', amount: 100 },
  { id: '3', name: 'Bravo', amount: 200 },
];

const columns: Column<Row>[] = [
  { key: 'name', header: 'Name', sortable: true, sortValue: (r) => r.name, render: (r) => r.name },
  {
    key: 'amount',
    header: 'Amount',
    money: true,
    sortable: true,
    sortValue: (r) => r.amount,
    render: (r) => String(r.amount),
  },
];

function names() {
  return screen
    .getAllByRole('row')
    .slice(1)
    .map((r) => within(r).getAllByRole('cell')[0]?.textContent);
}

describe('DataTable', () => {
  it('sorts client-side and toggles direction on repeated clicks', async () => {
    render(<DataTable columns={columns} rows={rows} rowKey={(r) => r.id} />);
    expect(names()).toEqual(['Charlie', 'alpha', 'Bravo']);
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(names()).toEqual(['alpha', 'Bravo', 'Charlie']);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
    await userEvent.click(screen.getByRole('button', { name: /Name/ }));
    expect(names()).toEqual(['Charlie', 'Bravo', 'alpha']);
    expect(screen.getByRole('columnheader', { name: /Name/ })).toHaveAttribute(
      'aria-sort',
      'descending',
    );
    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expect(names()).toEqual(['alpha', 'Bravo', 'Charlie']);
  });

  it('reports controlled sort changes without reordering', async () => {
    const onSortChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        sort={{ key: 'amount', dir: 'asc' }}
        onSortChange={onSortChange}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Amount/ }));
    expect(onSortChange).toHaveBeenCalledWith({ key: 'amount', dir: 'desc' });
    expect(names()).toEqual(['Charlie', 'alpha', 'Bravo']);
  });

  it('renders the empty state with an action', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        empty={{ title: 'No rows', description: 'Add one', action: <button>Add</button> }}
      />,
    );
    expect(screen.getByText('No rows')).toBeInTheDocument();
    expect(screen.getByText('Add one')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
  });

  it('renders loading and error states', () => {
    const { rerender } = render(
      <DataTable columns={columns} rows={undefined} rowKey={(r) => r.id} loading />,
    );
    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
    const onRetry = vi.fn();
    rerender(
      <DataTable
        columns={columns}
        rows={undefined}
        rowKey={(r) => r.id}
        error={new Error('Server exploded')}
        onRetry={onRetry}
      />,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Server exploded');
  });

  it('paginates and calls onPageChange', async () => {
    const onPageChange = vi.fn();
    render(
      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        pagination={{ page: 2, pageSize: 3, total: 10, onPageChange }}
      />,
    );
    expect(screen.getByText('Showing 4–6 of 10')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await userEvent.click(screen.getByRole('button', { name: '4' }));
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('right-aligns money columns and fires row clicks', async () => {
    const onRowClick = vi.fn();
    render(
      <DataTable columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={onRowClick} />,
    );
    const cells = within(screen.getAllByRole('row')[1]!).getAllByRole('cell');
    expect(cells[1]).toHaveClass('is-money', 'is-right');
    await userEvent.click(cells[0]!);
    expect(onRowClick).toHaveBeenCalledWith(rows[0]);
  });
});
