import { isRouteErrorResponse, Link, useRouteError } from 'react-router-dom';
import { errorMessage } from '../api/client';
import { Button } from '../components/Button';

/** Route-level error boundary element. */
export function ErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : 500;
  const message = isRouteErrorResponse(error)
    ? error.statusText || error.data
    : errorMessage(error);
  return (
    <div className="blank-page" role="alert">
      <div className="blank-page__code">{status}</div>
      <h1>{status === 404 ? 'Page not found' : 'Something went wrong'}</h1>
      <p className="muted" style={{ maxWidth: 480 }}>
        {typeof message === 'string'
          ? message
          : 'An unexpected error occurred while rendering this page.'}
      </p>
      <div className="row">
        <Button variant="primary" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Link className="btn btn--ghost" to="/workspaces">
          Go to workspaces
        </Link>
      </div>
    </div>
  );
}
