import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { user, workspaceSummary } from '../../test/fixtures';
import { errorBody, mockFetch } from '../../test/mockFetch';
import { renderWithProviders } from '../../test/render';
import { LoginPage } from './LoginPage';

describe('LoginPage', () => {
  it('shows the server error message on a failed login', async () => {
    mockFetch([
      { path: '/api/auth/me', status: 401, body: errorBody('unauthenticated', 'Not signed in') },
      {
        method: 'POST',
        path: '/api/auth/login',
        status: 401,
        body: errorBody('unauthenticated', 'Invalid email or password'),
      },
    ]);
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });
    await userEvent.type(screen.getByLabelText(/Email/), 'ada@northlight.studio');
    await userEvent.type(screen.getByLabelText(/Password/), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('validates locally before hitting the API', async () => {
    const { calls } = mockFetch([
      { path: '/api/auth/me', status: 401, body: errorBody('unauthenticated', 'Not signed in') },
    ]);
    renderWithProviders(<LoginPage />, { route: '/login', path: '/login' });
    await userEvent.type(screen.getByLabelText(/Email/), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument();
    expect(screen.getByText('Enter your password')).toBeInTheDocument();
    expect(calls.some((c) => c.url.pathname === '/api/auth/login')).toBe(false);
  });

  it('redirects to `next` after a successful login', async () => {
    let signedIn = false;
    mockFetch([
      {
        path: '/api/auth/me',
        body: () => (signedIn ? { user, workspaces: [workspaceSummary] } : undefined),
        status: 200,
      },
      {
        method: 'POST',
        path: '/api/auth/login',
        body: () => {
          signedIn = true;
          return { user };
        },
      },
    ]);
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/w/northlight/invoices" element={<div>Invoices landing</div>} />
      </Routes>,
      { route: '/login?next=%2Fw%2Fnorthlight%2Finvoices', path: '*' },
    );
    await userEvent.type(await screen.findByLabelText(/Email/), 'ada@northlight.studio');
    await userEvent.type(screen.getByLabelText(/Password/), 'password123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByText('Invoices landing')).toBeInTheDocument());
  });
});
