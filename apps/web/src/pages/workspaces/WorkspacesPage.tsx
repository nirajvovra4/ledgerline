import { useEffect } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  createWorkspaceSchema,
  CURRENCIES,
  labelFor,
  pluralize,
  ROLES,
  slugify,
} from '@ledgerline/shared';
import { useCreateWorkspace, useWorkspaces } from '../../api/workspaces';
import { Avatar } from '../../components/Avatar';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { ErrorState } from '../../components/ErrorState';
import { Field } from '../../components/Field';
import { Form, FormActions, FormError } from '../../components/Form';
import { BrandMark, IconPlus } from '../../components/Icons';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { SkeletonRows } from '../../components/Skeleton';
import { useAuth } from '../../hooks/useAuth';
import { useDocumentTitle } from '../../hooks/useDocumentTitle';
import { useForm } from '../../hooks/useForm';
import { useToast } from '../../hooks/useToast';
import { UserMenu } from '../../layout/UserMenu';

function CreateWorkspaceForm({ onDone }: { onDone: (slug: string) => void }) {
  const create = useCreateWorkspace();
  const form = useForm({
    schema: createWorkspaceSchema,
    initial: { name: '', currency: 'USD', slug: '' },
    transform: (v) => ({ ...v, slug: v.slug.trim() || undefined }),
    onSubmit: async (data) => {
      const res = await create.mutateAsync(data);
      onDone(res.workspace.slug);
    },
  });
  const preview = form.values.slug.trim() || slugify(form.values.name);
  return (
    <Form onSubmit={form.handleSubmit} aria-label="Create workspace">
      <FormError message={form.submitError} />
      <Field label="Workspace name" error={form.errors.name} required>
        <Input
          value={form.values.name}
          onChange={(e) => form.setValue('name', e.target.value)}
          placeholder="Northlight Studio"
          autoFocus
        />
      </Field>
      <Field
        label="Currency"
        error={form.errors.currency}
        required
        hint="Every amount in this workspace uses one currency."
      >
        <Select
          value={form.values.currency}
          onChange={(e) => form.setValue('currency', e.target.value)}
          options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
        />
      </Field>
      <Field
        label="URL slug"
        error={form.errors.slug}
        hint={
          preview ? (
            <>
              Your workspace will live at <code>/w/{preview}</code>
            </>
          ) : (
            'Leave blank to derive it from the name.'
          )
        }
      >
        <Input
          value={form.values.slug}
          onChange={(e) => form.setValue('slug', e.target.value)}
          placeholder={slugify(form.values.name) || 'northlight'}
        />
      </Field>
      <FormActions>
        <Button type="submit" variant="primary" loading={form.submitting}>
          Create workspace
        </Button>
      </FormActions>
    </Form>
  );
}

export function WorkspacesPage() {
  useDocumentTitle('Workspaces');
  const auth = useAuth();
  const list = useWorkspaces();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const creating = params.get('new') === '1';
  const missing = (location.state as { missingSlug?: string } | null)?.missingSlug;

  useEffect(() => {
    if (missing) toast.error('Workspace not available', `You don’t have access to “${missing}”.`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const items = list.data ?? auth.workspaces;

  return (
    <div className="content" style={{ minHeight: '100vh' }}>
      <div className="content__inner" style={{ maxWidth: 900 }}>
        <div className="row row--between" style={{ marginBottom: 32 }}>
          <div className="row" style={{ gap: 10 }}>
            <BrandMark />
            <span className="serif" style={{ fontSize: 'var(--text-lg)' }}>
              Ledgerline
            </span>
          </div>
          <UserMenu />
        </div>
        <header className="page-header">
          <div>
            <h1 className="page-header__title">Your workspaces</h1>
            <div className="page-header__sub">Signed in as {auth.user?.email}</div>
          </div>
          <div className="page-header__actions">
            <Button variant="primary" icon={<IconPlus />} onClick={() => setParams({ new: '1' })}>
              Create workspace
            </Button>
          </div>
        </header>
        {list.isLoading && items.length === 0 ? (
          <SkeletonRows rows={3} />
        ) : list.error && items.length === 0 ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title="No workspaces yet"
            description="A workspace holds one studio’s clients, invoices and books. Create your first one to get started."
            action={
              <Button variant="primary" onClick={() => setParams({ new: '1' })}>
                Create a workspace
              </Button>
            }
          />
        ) : (
          <div className="ws-grid">
            {items.map((w) => (
              <Link key={w.id} to={`/w/${w.slug}/dashboard`} className="ws-card">
                <Avatar name={w.name} size="lg" square />
                <div style={{ minWidth: 0 }}>
                  <div className="ws-card__name truncate">{w.name}</div>
                  <div className="ws-card__meta">
                    {labelFor(ROLES, w.role)} · {w.currency} · {pluralize(w.memberCount, 'member')}
                  </div>
                </div>
              </Link>
            ))}
            <button
              type="button"
              className="ws-card ws-card--new"
              onClick={() => setParams({ new: '1' })}
            >
              <IconPlus /> New workspace
            </button>
          </div>
        )}
        <Modal open={creating} onClose={() => setParams({})} title="Create a workspace">
          <CreateWorkspaceForm
            onDone={(slug) => {
              toast.success('Workspace created');
              navigate(`/w/${slug}/dashboard`);
            }}
          />
        </Modal>
      </div>
    </div>
  );
}
