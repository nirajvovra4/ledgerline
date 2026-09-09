import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCreateProject, useProject, useUpdateProject } from '../../api/projects';
import { ErrorState } from '../../components/ErrorState';
import { PageHeader } from '../../components/PageHeader';
import { SkeletonRows } from '../../components/Skeleton';
import { useToast } from '../../hooks/useToast';
import { useWorkspace } from '../../hooks/useWorkspace';
import { ProjectForm } from './ProjectForm';

export function ProjectFormPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const { base } = useWorkspace();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = useProject(id);
  const create = useCreateProject();
  const update = useUpdateProject(id ?? '');
  const editing = Boolean(id);

  if (editing && existing.isLoading) return <SkeletonRows rows={8} />;
  if (editing && existing.error)
    return <ErrorState error={existing.error} onRetry={() => existing.refetch()} />;
  const project = existing.data?.project;

  return (
    <div className="content--narrow">
      <PageHeader
        title={editing ? `Edit ${project?.name ?? 'project'}` : 'New project'}
        crumbs={[
          { label: 'Projects', to: `${base}/projects` },
          ...(project ? [{ label: project.name, to: `${base}/projects/${project.id}` }] : []),
          { label: editing ? 'Edit' : 'New' },
        ]}
      />
      <div className="paper">
        <div className="paper__body">
          <ProjectForm
            key={project?.id ?? 'new'}
            project={project}
            defaultClientId={params.get('clientId') ?? undefined}
            submitLabel={editing ? 'Save changes' : 'Create project'}
            onSubmit={async (data) => {
              if (editing && project) {
                await update.mutateAsync(data);
                toast.success('Project updated');
                navigate(`${base}/projects/${project.id}`);
              } else {
                const res = await create.mutateAsync(data);
                toast.success('Project created');
                navigate(`${base}/projects/${res.project.id}`);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
