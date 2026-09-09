import {
  approvalDecisionSchema,
  expenseInputSchema,
  expenseListQuerySchema,
  payExpenseSchema,
  rejectionSchema,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  approveExpense,
  createExpense,
  deleteExpense,
  getExpenseDetail,
  listExpenses,
  payExpense,
  rejectExpense,
  submitExpense,
  updateExpense,
} from '../services/expenses';

type IdParams = { Params: { id: string } };

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/expenses', async (request) => {
    const query = parse(expenseListQuerySchema, request.query);
    return listExpenses(wctx(request), query);
  });

  app.post(
    '/expenses',
    { preHandler: requirePermission('expenses.create') },
    async (request, reply) => {
      const input = parse(expenseInputSchema, request.body);
      return reply.status(201).send(await createExpense(wctx(request), input));
    },
  );

  app.get<IdParams>('/expenses/:id', async (request) =>
    getExpenseDetail(wctx(request), request.params.id),
  );

  app.patch<IdParams>(
    '/expenses/:id',
    { preHandler: requirePermission('expenses.create') },
    async (request) => {
      const input = parse(expenseInputSchema.innerType().partial(), request.body);
      return updateExpense(wctx(request), request.params.id, input);
    },
  );

  app.delete<IdParams>(
    '/expenses/:id',
    { preHandler: requirePermission('expenses.create') },
    async (request) => {
      await deleteExpense(wctx(request), request.params.id);
      return { ok: true };
    },
  );

  app.post<IdParams>(
    '/expenses/:id/submit',
    { preHandler: requirePermission('expenses.create') },
    async (request) => submitExpense(wctx(request), request.params.id),
  );

  app.post<IdParams>(
    '/expenses/:id/approve',
    { preHandler: requirePermission('expenses.approve') },
    async (request) => {
      const { comment } = parse(approvalDecisionSchema, request.body);
      return approveExpense(wctx(request), request.params.id, comment);
    },
  );

  app.post<IdParams>(
    '/expenses/:id/reject',
    { preHandler: requirePermission('expenses.approve') },
    async (request) => {
      const { comment } = parse(rejectionSchema, request.body);
      return rejectExpense(wctx(request), request.params.id, comment);
    },
  );

  app.post<IdParams>(
    '/expenses/:id/pay',
    { preHandler: requirePermission('expenses.approve') },
    async (request) => {
      const input = parse(payExpenseSchema, request.body);
      return payExpense(wctx(request), request.params.id, input);
    },
  );
};
