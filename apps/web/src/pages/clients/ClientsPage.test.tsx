import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { makeClient, SLUG } from '../../test/fixtures';
import { mockFetch } from '../../test/mockFetch';
import { renderWithProviders } from '../../test/render';
import { ClientsPage } from './ClientsPage';

const acme = makeClient({ name: 'Acme Studios', outstandingCents: 125000 });
const bravo = makeClient({
  name: 'Bravo Films',
  email: 'ap@bravo.test',
  outstandingCents: 0,
  status: 'active',
});

describe('ClientsPage', () => {
  it('renders rows from the API and filters by search and status', async () => {
    const { calls } = mockFetch([
      {
        path: `/api/w/${SLUG}/clients`,
        body: ({ url }) => {
          const q = url.searchParams.get('q') ?? '';
          const items = [acme, bravo].filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
          return { items, total: items.length, page: 1, pageSize: 25 };
        },
      },
      {
        path: `/api/w/${SLUG}/notifications`,
        body: { items: [], total: 0, page: 1, pageSize: 1, unreadCount: 0 },
      },
    ]);
    renderWithProviders(<ClientsPage />, {
      route: `/w/${SLUG}/clients`,
      path: '/w/:slug/clients',
      workspace: true,
    });

    expect(await screen.findByText('Acme Studios')).toBeInTheDocument();
    expect(screen.getByText('Bravo Films')).toBeInTheDocument();
    expect(screen.getByText('$1,250.00')).toBeInTheDocument();
    expect(screen.getByText('2 clients')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New client' })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search clients'), 'bravo');
    await waitFor(() => expect(screen.queryByText('Acme Studios')).toBeNull());
    expect(screen.getByText('Bravo Films')).toBeInTheDocument();
    const last = calls.filter((c) => c.url.pathname.endsWith('/clients')).at(-1);
    expect(last?.url.searchParams.get('q')).toBe('bravo');
    expect(last?.url.searchParams.get('status')).toBe('active');

    await userEvent.selectOptions(screen.getByLabelText('Status filter'), 'archived');
    await waitFor(() => {
      const c = calls.filter((x) => x.url.pathname.endsWith('/clients')).at(-1);
      expect(c?.url.searchParams.get('status')).toBe('archived');
    });
  });

  it('shows an empty state and hides the New button for members', async () => {
    mockFetch([
      { path: `/api/w/${SLUG}/clients`, body: { items: [], total: 0, page: 1, pageSize: 25 } },
    ]);
    renderWithProviders(<ClientsPage />, {
      route: `/w/${SLUG}/clients`,
      path: '/w/:slug/clients',
      workspace: true,
      role: 'member',
    });
    expect(await screen.findByText('No clients yet')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'New client' })).toBeNull();
  });

  it('shows an error state when the API fails', async () => {
    mockFetch([
      {
        path: `/api/w/${SLUG}/clients`,
        status: 500,
        body: { error: { code: 'internal_error', message: 'Database unavailable' } },
      },
    ]);
    renderWithProviders(<ClientsPage />, {
      route: `/w/${SLUG}/clients`,
      path: '/w/:slug/clients',
      workspace: true,
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });
});
