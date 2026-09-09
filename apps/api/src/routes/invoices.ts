import {
  approvalDecisionSchema,
  invoiceFromTimeSchema,
  invoiceInputSchema,
  invoiceListQuerySchema,
  recordPaymentSchema,
  rejectionSchema,
  voidInvoiceSchema,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  approveInvoice,
  createInvoice,
  createInvoiceFromTime,
  deleteInvoice,
  getInvoiceDetail,
  listInvoices,
  rejectInvoice,
  sendInvoice,
  submitInvoice,
  updateInvoice,
  voidInvoice,
} from '../services/invoices';
import { recordPayment } from '../services/payments';

type IdParams = { Params: { id: string } };

export const invoiceRoutes: FastifyPluginAsync = async (app) => {
  app.get('/invoices', { preHandler: requirePermission('clients.view') }, async (request) => {
    const query = parse(invoiceListQuerySchema, request.query);
    return listInvoices(wctx(request), query);
  });

  app.post(
    '/invoices',
    { preHandler: requirePermission('invoices.create') },
    async (request, reply) => {
      const input = parse(invoiceInputSchema, request.body);
      return reply.status(201).send({ invoice: await createInvoice(wctx(request), input) });
    },
  );

  app.post(
    '/invoices/from-time',
    { preHandler: requirePermission('invoices.create') },
    async (request, reply) => {
      const input = parse(invoiceFromTimeSchema, request.body);
      return reply.status(201).send({ invoice: await createInvoiceFromTime(wctx(request), input) });
    },
  );

  app.get<IdParams>(
    '/invoices/:id',
    { preHandler: requirePermission('clients.view') },
    async (request) => ({
      invoice: await getInvoiceDetail(wctx(request), request.params.id),
    }),
  );

  app.patch<IdParams>(
    '/invoices/:id',
    { preHandler: requirePermission('invoices.create') },
    async (request) => {
      const input = parse(invoiceInputSchema, request.body);
      return { invoice: await updateInvoice(wctx(request), request.params.id, input) };
    },
  );

  app.delete<IdParams>(
    '/invoices/:id',
    { preHandler: requirePermission('invoices.create') },
    async (request) => {
      await deleteInvoice(wctx(request), request.params.id);
      return { ok: true };
    },
  );

  app.post<IdParams>(
    '/invoices/:id/submit',
    { preHandler: requirePermission('invoices.create') },
    async (request) => ({
      invoice: await submitInvoice(wctx(request), request.params.id),
    }),
  );

  app.post<IdParams>(
    '/invoices/:id/approve',
    { preHandler: requirePermission('invoices.approve') },
    async (request) => {
      const { comment } = parse(approvalDecisionSchema, request.body);
      return { invoice: await approveInvoice(wctx(request), request.params.id, comment) };
    },
  );

  app.post<IdParams>(
    '/invoices/:id/reject',
    { preHandler: requirePermission('invoices.approve') },
    async (request) => {
      const { comment } = parse(rejectionSchema, request.body);
      return { invoice: await rejectInvoice(wctx(request), request.params.id, comment) };
    },
  );

  app.post<IdParams>(
    '/invoices/:id/send',
    { preHandler: requirePermission('invoices.send') },
    async (request) => ({
      invoice: await sendInvoice(wctx(request), request.params.id),
    }),
  );

  app.post<IdParams>(
    '/invoices/:id/void',
    { preHandler: requirePermission('invoices.void') },
    async (request) => {
      const { reason } = parse(voidInvoiceSchema, request.body);
      return { invoice: await voidInvoice(wctx(request), request.params.id, reason) };
    },
  );

  app.post<IdParams>(
    '/invoices/:id/payments',
    { preHandler: requirePermission('payments.manage') },
    async (request, reply) => {
      const input = parse(recordPaymentSchema, request.body);
      const result = await recordPayment(wctx(request), request.params.id, input);
      return reply.status(201).send(result);
    },
  );
};
