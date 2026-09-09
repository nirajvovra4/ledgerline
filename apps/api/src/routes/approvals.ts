import { approvalListQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { listApprovals } from '../services/approvals';

export const approvalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/approvals', async (request) => {
    const { status } = parse(approvalListQuerySchema, request.query);
    return { items: await listApprovals(wctx(request), status) };
  });
};
