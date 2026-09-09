import { paymentListQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { deletePayment, listPayments } from '../services/payments';

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get('/payments', { preHandler: requirePermission('clients.view') }, async (request) => {
    const query = parse(paymentListQuerySchema, request.query);
    return listPayments(wctx(request), query);
  });

  app.delete<{ Params: { id: string } }>(
    '/payments/:id',
    { preHandler: requirePermission('payments.manage') },
    async (request) => {
      await deletePayment(wctx(request), request.params.id);
      return { ok: true };
    },
  );
};
