import { taxRateInputSchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { archiveTaxRate, createTaxRate, listTaxRates, updateTaxRate } from '../services/taxRates';

type IdParams = { Params: { id: string } };

const taxRatePatchSchema = taxRateInputSchema
  .partial()
  .extend({ archived: z.boolean().optional() });

export const taxRateRoutes: FastifyPluginAsync = async (app) => {
  app.get('/tax-rates', async (request) => ({ items: await listTaxRates(wctx(request)) }));

  app.post(
    '/tax-rates',
    { preHandler: requirePermission('workspace.manage') },
    async (request, reply) => {
      const input = parse(taxRateInputSchema, request.body);
      return reply.status(201).send({ taxRate: await createTaxRate(wctx(request), input) });
    },
  );

  app.patch<IdParams>(
    '/tax-rates/:id',
    { preHandler: requirePermission('workspace.manage') },
    async (request) => {
      const input = parse(taxRatePatchSchema, request.body);
      return { taxRate: await updateTaxRate(wctx(request), request.params.id, input) };
    },
  );

  app.delete<IdParams>(
    '/tax-rates/:id',
    { preHandler: requirePermission('workspace.manage') },
    async (request) => ({
      taxRate: await archiveTaxRate(wctx(request), request.params.id),
    }),
  );
};
