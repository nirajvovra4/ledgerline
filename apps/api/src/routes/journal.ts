import {
  assertBalanced,
  journalListQuerySchema,
  manualJournalEntrySchema,
  reverseEntrySchema,
  UnbalancedEntryError,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { unbalanced } from '../errors';
import { parse } from '../lib/parse';
import {
  createManualEntry,
  getEntry,
  listJournal,
  reverseEntryManually,
} from '../services/journal';

type IdParams = { Params: { id: string } };

export const journalRoutes: FastifyPluginAsync = async (app) => {
  app.get('/journal', { preHandler: requirePermission('ledger.view') }, async (request) => {
    const query = parse(journalListQuerySchema, request.query);
    return listJournal(wctx(request), query);
  });

  app.post('/journal', { preHandler: requirePermission('ledger.post') }, async (request, reply) => {
    // Validate the shape first, then check balance separately so an unbalanced entry is a 422
    // (`unbalanced_entry`) rather than a generic 400.
    const input = parse(manualJournalEntrySchema.innerType(), request.body);
    try {
      assertBalanced(input.lines);
    } catch (err) {
      if (err instanceof UnbalancedEntryError) throw unbalanced(err.debitCents, err.creditCents);
      throw err;
    }
    return reply.status(201).send({ entry: await createManualEntry(wctx(request), input) });
  });

  app.get<IdParams>(
    '/journal/:id',
    { preHandler: requirePermission('ledger.view') },
    async (request) => ({
      entry: await getEntry(wctx(request), request.params.id),
    }),
  );

  app.post<IdParams>(
    '/journal/:id/reverse',
    { preHandler: requirePermission('ledger.post') },
    async (request, reply) => {
      const input = parse(reverseEntrySchema, request.body);
      return reply
        .status(201)
        .send({ entry: await reverseEntryManually(wctx(request), request.params.id, input) });
    },
  );
};
