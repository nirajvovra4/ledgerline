import { useEffect, useRef } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAcceptInvite } from '../../api/auth';
import { errorMessage } from '../../api/client';
import { LinkButton } from '../../components/Button';
import { SkeletonRows } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';

export function InvitePage() {
  useDocumentTitle('Workspace invitation');
  const { token = '' } = useParams<{ token: string }>();
  const auth = useAuth();
  const accept = useAcceptInvite();
  const navigate = useNavigate();
  const attempted = useRef(false);

  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || attempted.current || !token) return;
    attempted.current = true;
    accept.mutate(token, {
      onSuccess: (res) => navigate(`/w/${res.workspace.slug}/dashboard`, { replace: true }),
    });
  }, [auth.isLoading, auth.isAuthenticated, token, accept, navigate]);

  if (
    auth.isLoading ||
    (auth.isAuthenticated && accept.isPending) ||
    (auth.isAuthenticated && accept.isIdle)
  ) {
    return (
      <>
        <h1 className="auth__title">Joining workspace…</h1>
        <SkeletonRows rows={2} />
      </>
    );
  }

  if (auth.isAuthenticated && accept.isError) {
    return (
      <>
        <h1 className="auth__title">Invitation problem</h1>
        <p className="auth__sub">{errorMessage(accept.error)}</p>
        <LinkButton to="/workspaces" variant="primary" block>
          Go to your workspaces
        </LinkButton>
      </>
    );
  }

  return (
    <>
      <h1 className="auth__title">You’re invited</h1>
      <p className="auth__sub">Sign in or create an account to join the workspace.</p>
      <div className="stack stack--sm">
        <LinkButton to={`/register?invite=${encodeURIComponent(token)}`} variant="primary" block>
          Create an account
        </LinkButton>
        <LinkButton to={`/login?next=${encodeURIComponent(`/invite/${token}`)}`} block>
          I already have an account
        </LinkButton>
      </div>
      <div className="auth__foot">
        <Link to="/login">Back to sign in</Link>
      </div>
    </>
  );
}
