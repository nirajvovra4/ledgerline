import { Navigate, Outlet } from 'react-router-dom';
import { useSlug } from '../api/slug';
import { useWorkspaceQuery } from '../api/workspaces';
import { isApiError } from '../api/client';
import { ErrorState } from '../components/ErrorState';
import { SkeletonRows } from '../components/Skeleton';
import { WorkspaceProvider } from '../hooks/useWorkspace';
import { AppShell } from './AppShell';

/** Loads `/api/w/:slug`, provides the workspace context and renders the shell. */
export function WorkspaceLayout() {
  const slug = useSlug();
  const query = useWorkspaceQuery(slug);
  if (query.isLoading) {
    return (
      <div className="auth">
        <div style={{ width: 360 }}>
          <SkeletonRows rows={4} />
        </div>
      </div>
    );
  }
  if (query.error) {
    if (isApiError(query.error) && (query.error.status === 404 || query.error.status === 403)) {
      return <Navigate to="/workspaces" replace state={{ missingSlug: slug }} />;
    }
    return (
      <div className="auth">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }
  if (!query.data) return null;
  return (
    <WorkspaceProvider workspace={query.data.workspace} role={query.data.role}>
      <AppShell>
        <Outlet />
      </AppShell>
    </WorkspaceProvider>
  );
}

/** Bare layout for the print route (no rail/strip). */
export function WorkspaceBareLayout() {
  const slug = useSlug();
  const query = useWorkspaceQuery(slug);
  if (query.isLoading) return <SkeletonRows rows={4} />;
  if (query.error || !query.data)
    return (
      <ErrorState
        error={query.error ?? new Error('Workspace unavailable')}
        onRetry={() => query.refetch()}
      />
    );
  return (
    <WorkspaceProvider workspace={query.data.workspace} role={query.data.role}>
      <Outlet />
    </WorkspaceProvider>
  );
}
