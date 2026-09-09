import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { CalendarEvent } from '@ledgerline/shared';
import { SLUG, TODAY } from '../../test/fixtures';
import { mockFetch } from '../../test/mockFetch';
import { renderWithProviders } from '../../test/render';
import { CalendarGrid, CalendarPage } from './CalendarPage';

const events: CalendarEvent[] = [
  {
    id: 'e1',
    kind: 'invoice_due',
    date: '2026-06-15',
    title: 'INV-1001 due',
    subtitle: 'Acme',
    amountCents: 120000,
    link: 'invoices/x',
    tone: 'warning',
  },
  {
    id: 'e2',
    kind: 'payment_received',
    date: '2026-06-15',
    title: 'Payment INV-0990',
    subtitle: 'Bravo',
    amountCents: 50000,
    link: 'payments',
    tone: 'positive',
  },
  {
    id: 'e3',
    kind: 'expense_due',
    date: '2026-06-02',
    title: 'Figma',
    subtitle: 'Expense',
    amountCents: 4500,
    link: 'expenses/y',
    tone: 'negative',
  },
];

describe('CalendarGrid', () => {
  it('renders a fixed month as a 6×7 grid starting on Monday with today highlighted', () => {
    renderWithProviders(
      <CalendarGrid
        year={2026}
        month={6}
        today={TODAY}
        events={events}
        selected=""
        onSelect={() => undefined}
        compact={(c) => `$${c / 100}`}
      />,
      { workspace: true },
    );
    const cells = screen.getAllByRole('gridcell');
    expect(cells).toHaveLength(42);
    // June 2026 starts on a Monday, so the first cell is 1 June and the last is 12 July.
    expect(cells[0]).toHaveAttribute('data-date', '2026-06-01');
    expect(cells[41]).toHaveAttribute('data-date', '2026-07-12');
    expect(cells[0]).not.toHaveClass('is-outside');
    expect(cells[30]).toHaveAttribute('data-date', '2026-07-01');
    expect(cells[30]).toHaveClass('is-outside');
    expect(screen.getByRole('gridcell', { name: /30 June 2026/ })).toHaveClass('is-today');
    const june15 = screen.getByRole('gridcell', { name: /15 June 2026, 2 events/ });
    expect(within(june15).getByText('INV-1001 due')).toBeInTheDocument();
    expect(within(june15).getByText('$1200')).toBeInTheDocument();
  });
});

describe('CalendarPage', () => {
  it('loads the month from the URL, lists events and opens the day panel on click', async () => {
    mockFetch([
      { path: '/api/meta', body: { today: TODAY, version: 't', fixedClock: true } },
      {
        path: `/api/w/${SLUG}/calendar`,
        body: ({ url }) => ({ events: url.searchParams.get('month') === '2026-06' ? events : [] }),
      },
    ]);
    renderWithProviders(<CalendarPage />, {
      route: `/w/${SLUG}/calendar?month=2026-06`,
      path: '/w/:slug/calendar',
      workspace: true,
    });
    expect(await screen.findByText('June 2026')).toBeInTheDocument();
    expect((await screen.findAllByText('INV-1001 due')).length).toBeGreaterThan(0);
    await userEvent.click(screen.getByRole('gridcell', { name: /15 June 2026/ }));
    expect(screen.getByRole('heading', { name: 'Monday, 15 June 2026' })).toBeInTheDocument();
    const panel = screen.getByRole('heading', { name: 'Monday, 15 June 2026' }).closest('aside')!;
    expect(within(panel).getByText('Payment INV-0990')).toBeInTheDocument();
    expect(within(panel).queryByText('Figma')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(await screen.findByText('May 2026')).toBeInTheDocument();
  });
});
