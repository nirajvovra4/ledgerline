import { accountInputSchema, registerQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { accountRegister, createAccount, listAccounts, updateAccount } from '../services/accounts';

type IdParams = { Params: { id: string } };

const listQuerySchema = z.object({
  includeArchived: z
    .preprocess((v) => v === 'true' || v === '1' || v === true, z.boolean())
    .catch(false),
});

export const accountRoutes: FastifyPluginAsync = async (app) => {
  // Invoice/expense editors need the chart of accounts, so every member may read it.
  app.get('/accounts', async (request) => {
    const { includeArchived } = parse(listQuerySchema, request.query);
    return listAccounts(wctx(request), includeArchived);
  });

  app.post(
    '/accounts',
    { preHandler: requirePermission('ledger.post') },
    async (request, reply) => {
      const input = parse(accountInputSchema, request.body);
      return reply.status(201).send({ account: await createAccount(wctx(request), input) });
    },
  );

  app.patch<IdParams>(
    '/accounts/:id',
    { preHandler: requirePermission('ledger.post') },
    async (request) => {
      const input = parse(accountInputSchema.partial(), request.body);
      return { account: await updateAccount(wctx(request), request.params.id, input) };
    },
  );

  app.get<IdParams>(
    '/accounts/:id/register',
    { preHandler: requirePermission('ledger.view') },
    async (request) => {
      const query = parse(registerQuerySchema, request.query);
      return accountRegister(wctx(request), request.params.id, query);
    },
  );
};
