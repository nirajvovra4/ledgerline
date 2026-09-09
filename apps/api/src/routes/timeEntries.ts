import {
  dateRangeSchema,
  timeEntryInputSchema,
  timeEntryListQuerySchema,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  createTimeEntry,
  deleteTimeEntry,
  getTimeEntry,
  listTimeEntries,
  timeSummary,
  updateTimeEntry,
} from '../services/timeEntries';

type IdParams = { Params: { id: string } };

const summaryQuerySchema = dateRangeSchema.and(z.object({ userId: z.string().uuid().optional() }));

export const timeEntryRoutes: FastifyPluginAsync = async (app) => {
  app.get('/time-entries', async (request) => {
    const query = parse(timeEntryListQuerySchema, request.query);
    return listTimeEntries(wctx(request), query);
  });

  // Declared before `/time-entries/:id` so the literal segment wins.
  app.get('/time-entries/summary', async (request) => {
    const query = parse(summaryQuerySchema, request.query);
    return timeSummary(wctx(request), { from: query.from, to: query.to }, query.userId);
  });

  app.post('/time-entries', async (request, reply) => {
    const input = parse(timeEntryInputSchema, request.body);
    return reply.status(201).send({ entry: await createTimeEntry(wctx(request), input) });
  });

  app.get<IdParams>('/time-entries/:id', async (request) => ({
    entry: await getTimeEntry(wctx(request), request.params.id),
  }));

  app.patch<IdParams>('/time-entries/:id', async (request) => {
    const input = parse(timeEntryInputSchema.partial(), request.body);
    return { entry: await updateTimeEntry(wctx(request), request.params.id, input) };
  });

  app.delete<IdParams>('/time-entries/:id', async (request) => {
    await deleteTimeEntry(wctx(request), request.params.id);
    return { ok: true };
  });
};
