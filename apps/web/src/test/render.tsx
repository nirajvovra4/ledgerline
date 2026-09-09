import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { Role } from '@ledgerline/shared';
import { ToastProvider } from '../hooks/useToast';
import { WorkspaceProvider } from '../hooks/useWorkspace';
import { workspace as defaultWorkspace } from './fixtures';

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Initial URL, e.g. `/w/northlight/clients?q=acme`. */
  route?: string;
  /** Route pattern to mount the element on, e.g. `/w/:slug/clients`. */
  path?: string;
  /** Wrap in a WorkspaceProvider with the fixture workspace. */
  workspace?: boolean;
  role?: Role;
  queryClient?: QueryClient;
}

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(ui: ReactElement, options: RenderWithProvidersOptions = {}) {
  const {
    route = '/',
    path = '*',
    workspace = false,
    role = 'owner',
    queryClient = createTestQueryClient(),
    ...rest
  } = options;
  const inner = workspace ? (
    <WorkspaceProvider workspace={defaultWorkspace} role={role}>
      {ui}
    </WorkspaceProvider>
  ) : (
    ui
  );
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path={path} element={children} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  }
  return { ...render(inner, { wrapper: Wrapper, ...rest }), queryClient };
}
