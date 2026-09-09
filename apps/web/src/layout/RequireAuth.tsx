import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { SkeletonRows } from '../components/Skeleton';
import { useAuth } from '../hooks/useAuth';

/** Gate for authenticated routes; sends visitors to /login while preserving the target in `next`. */
export function RequireAuth() {
  const auth = useAuth();
  const location = useLocation();
  if (auth.isLoading) {
    return (
      <div className="auth">
        <div style={{ width: 320 }}>
          <SkeletonRows rows={3} />
        </div>
      </div>
    );
  }
  if (auth.error && !auth.user) {
    return (
      <div className="auth">
        <ErrorState error={auth.error} onRetry={() => auth.refetch()} />
      </div>
    );
  }
  if (!auth.isAuthenticated) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login?next=${encodeURIComponent(next)}`} replace />;
  }
  return <Outlet />;
}
