import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { RouterProvider } from 'react-router-dom';
import { isApiError } from './api/client';
import { SkeletonRows } from './components/Skeleton';
import { ToastProvider } from './hooks/useToast';
import { router } from './router';

export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15 * 1000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status > 0 && error.status < 500) return false;
          return failureCount < 2;
        },
      },
      mutations: { retry: false },
    },
  });
}

export function App() {
  const [queryClient] = useState(createAppQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <Suspense
          fallback={
            <div className="auth">
              <div style={{ width: 320 }}>
                <SkeletonRows rows={3} />
              </div>
            </div>
          }
        >
          <RouterProvider router={router} />
        </Suspense>
      </ToastProvider>
    </QueryClientProvider>
  );
}
