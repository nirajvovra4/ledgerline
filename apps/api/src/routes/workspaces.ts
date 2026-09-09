import { createWorkspaceSchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requireUser, userOf } from '../auth/guards';
import { parse } from '../lib/parse';
import { createWorkspace, listWorkspacesForUser } from '../services/workspaces';

export const workspacesRoutes: FastifyPluginAsync = async (app) => {
  app.get('/workspaces', { preHandler: requireUser }, async (request) => ({
    items: await listWorkspacesForUser(app.ctx, userOf(request).id),
  }));

  app.post('/workspaces', { preHandler: requireUser }, async (request, reply) => {
    const input = parse(createWorkspaceSchema, request.body);
    const workspace = await createWorkspace(app.ctx, userOf(request), input);
    return reply.status(201).send({ workspace });
  });
};
