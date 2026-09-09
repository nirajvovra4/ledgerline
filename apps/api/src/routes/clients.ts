import { clientInputSchema, clientListQuerySchema, dateRangeSchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  archiveClient,
  createClient,
  getClientDetail,
  listClients,
  updateClient,
} from '../services/clients';
import { clientStatement } from '../services/reports';

type IdParams = { Params: { id: string } };

export const clientRoutes: FastifyPluginAsync = async (app) => {
  app.get('/clients', { preHandler: requirePermission('clients.view') }, async (request) => {
    const query = parse(clientListQuerySchema, request.query);
    return listClients(wctx(request), query);
  });

  app.post(
    '/clients',
    { preHandler: requirePermission('clients.manage') },
    async (request, reply) => {
      const input = parse(clientInputSchema, request.body);
      return reply.status(201).send({ client: await createClient(wctx(request), input) });
    },
  );

  app.get<IdParams>(
    '/clients/:id',
    { preHandler: requirePermission('clients.view') },
    async (request) => getClientDetail(wctx(request), request.params.id),
  );

  app.patch<IdParams>(
    '/clients/:id',
    { preHandler: requirePermission('clients.manage') },
    async (request) => {
      const input = parse(clientInputSchema.partial(), request.body);
      return { client: await updateClient(wctx(request), request.params.id, input) };
    },
  );

  app.delete<IdParams>(
    '/clients/:id',
    { preHandler: requirePermission('clients.manage') },
    async (request) => ({
      client: await archiveClient(wctx(request), request.params.id),
    }),
  );

  app.get<IdParams>(
    '/clients/:id/statement',
    { preHandler: requirePermission('clients.view') },
    async (request) => {
      const range = parse(dateRangeSchema, request.query);
      return clientStatement(wctx(request), request.params.id, range);
    },
  );
};
