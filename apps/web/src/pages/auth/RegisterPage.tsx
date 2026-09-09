import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { registerSchema } from '@ledgerline/shared';
import { useAcceptInvite } from '../../api/auth';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Form, FormError } from '../../components/Form';
import { Input } from '../../components/Input';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useForm } from '../../hooks/useForm';

export function RegisterPage() {
  useDocumentTitle('Create account');
  const auth = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('invite') ?? '';
  const acceptInvite = useAcceptInvite();

  const form = useForm({
    schema: registerSchema,
    initial: {
      name: '',
      email: params.get('email') ?? '',
      password: '',
      inviteToken: inviteToken || undefined,
    },
    onSubmit: async (data) => {
      await auth.register.mutateAsync(data);
      if (inviteToken) {
        try {
          const res = await acceptInvite.mutateAsync(inviteToken);
          navigate(`/w/${res.workspace.slug}/dashboard`, { replace: true });
          return;
        } catch {
          /* fall through to the workspaces page, which will explain */
        }
      }
      navigate('/workspaces', { replace: true });
    },
  });

  if (!auth.isLoading && auth.isAuthenticated)
    return <Navigate to={inviteToken ? `/invite/${inviteToken}` : '/workspaces'} replace />;

  return (
    <>
      <h1 className="auth__title">Create your account</h1>
      <p className="auth__sub">
        {inviteToken
          ? 'You’ve been invited to a workspace. Set up your account to join.'
          : 'A workspace for your studio takes a minute.'}
      </p>
      <Form onSubmit={form.handleSubmit} aria-label="Register">
        <FormError message={form.submitError} />
        <Field label="Your name" error={form.errors.name} required>
          <Input
            autoComplete="name"
            value={form.values.name}
            onChange={(e) => form.setValue('name', e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Email" error={form.errors.email} required>
          <Input
            type="email"
            autoComplete="email"
            value={form.values.email}
            onChange={(e) => form.setValue('email', e.target.value)}
          />
        </Field>
        <Field label="Password" error={form.errors.password} hint="At least 8 characters." required>
          <Input
            type="password"
            autoComplete="new-password"
            value={form.values.password}
            onChange={(e) => form.setValue('password', e.target.value)}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={form.submitting}>
          {inviteToken ? 'Create account & join' : 'Create account'}
        </Button>
      </Form>
      <div className="auth__foot">
        Already have an account?{' '}
        <Link
          to={
            inviteToken ? `/login?next=${encodeURIComponent(`/invite/${inviteToken}`)}` : '/login'
          }
        >
          Sign in
        </Link>
      </div>
    </>
  );
}
