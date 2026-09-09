import { Navigate, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { loginSchema } from '@ledgerline/shared';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useForm } from '../../hooks/useForm';

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/workspaces';
  return raw;
}

export function LoginPage() {
  useDocumentTitle('Sign in');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));

  const form = useForm({
    schema: loginSchema,
    initial: { email: '', password: '' },
    onSubmit: async (data) => {
      await auth.login.mutateAsync(data);
      navigate(next, { replace: true });
    },
  });

  if (!auth.isLoading && auth.isAuthenticated) return <Navigate to={next} replace />;

  return (
    <>
      <h1 className="auth__title">Sign in</h1>
      <p className="auth__sub">Welcome back. Open your ledger.</p>
      <Form onSubmit={form.handleSubmit} aria-label="Sign in">
        <FormError message={form.submitError} />
        <Field label="Email" error={form.errors.email} required>
          <Input
            type="email"
            autoComplete="email"
            value={form.values.email}
            onChange={(e) => form.setValue('email', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Password" error={form.errors.password} required>
          <Input
            type="password"
            autoComplete="current-password"
            value={form.values.password}
            onChange={(e) => form.setValue('password', e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.submitting}>
          Sign in
        </Button>
      </Form>
      <div className="auth__foot">
        New here?{' '}
        <Link to={`/register${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`}>
          Create an account
        </Link>
      </div>
      <div className="auth__demo">
        Demo: <code>ada@northlight.studio</code> / <code>password123</code> (owner) ·{' '}
        <code>marcus@</code> (accountant) · <code>priya@</code> (member)
      </div>
    </>
  );
}
