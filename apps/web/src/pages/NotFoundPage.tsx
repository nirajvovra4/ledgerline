import { Link } from 'react-router-dom';
import { useDocumentTitle } from '../hooks/useDocumentTitle';
import { useOptionalWorkspace } from '../hooks/useWorkspace';

export function NotFoundPage() {
  useDocumentTitle('Not found');
  const ws = useOptionalWorkspace();
  return (
    <div className="blank-page">
      <div className="blank-page__code">404</div>
      <h1>Page not found</h1>
      <p className="muted">The page you were looking for isn’t in this ledger.</p>
      <Link className="btn btn--secondary" to={ws ? `${ws.base}/dashboard` : '/workspaces'}>
        {ws ? 'Back to dashboard' : 'Go to your workspaces'}
      </Link>
    </div>
  );
}
