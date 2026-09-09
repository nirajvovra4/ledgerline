import { projectInputSchema, projectListQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  archiveProject,
  createProject,
  getProjectDetail,
  listProjects,
  updateProject,
} from '../services/projects';

type IdParams = { Params: { id: string } };

export const projectRoutes: FastifyPluginAsync = async (app) => {
  app.get('/projects', { preHandler: requirePermission('clients.view') }, async (request) => {
    const query = parse(projectListQuerySchema, request.query);
    return listProjects(wctx(request), query);
  });

  app.post(
    '/projects',
    { preHandler: requirePermission('projects.manage') },
    async (request, reply) => {
      const input = parse(projectInputSchema, request.body);
      return reply.status(201).send({ project: await createProject(wctx(request), input) });
    },
  );

  app.get<IdParams>(
    '/projects/:id',
    { preHandler: requirePermission('clients.view') },
    async (request) => getProjectDetail(wctx(request), request.params.id),
  );

  app.patch<IdParams>(
    '/projects/:id',
    { preHandler: requirePermission('projects.manage') },
    async (request) => {
      const input = parse(projectInputSchema.innerType().partial(), request.body);
      return { project: await updateProject(wctx(request), request.params.id, input) };
    },
  );

  app.delete<IdParams>(
    '/projects/:id',
    { preHandler: requirePermission('projects.manage') },
    async (request) => ({
      project: await archiveProject(wctx(request), request.params.id),
    }),
  );
};
