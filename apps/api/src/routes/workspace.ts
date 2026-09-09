import {
  dashboardQuerySchema,
  monthQuerySchema,
  searchQuerySchema,
  updateWorkspaceSchema,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requirePermission, requireWorkspace, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { mapWorkspace } from '../mappers';
import { listActivity } from '../services/activity';
import { calendarMonth } from '../services/calendar';
import { dashboard } from '../services/dashboard';
import { search } from '../services/search';
import { updateWorkspace } from '../services/workspaces';
import { accountRoutes } from './accounts';
import { approvalRoutes } from './approvals';
import { clientRoutes } from './clients';
import { expenseRoutes } from './expenses';
import { invoiceRoutes } from './invoices';
import { journalRoutes } from './journal';
import { memberRoutes } from './members';
import { notificationRoutes } from './notifications';
import { paymentRoutes } from './payments';
import { projectRoutes } from './projects';
import { reportRoutes } from './reports';
import { taxRateRoutes } from './taxRates';
import { timeEntryRoutes } from './timeEntries';

const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).catch(50),
  before: z.string().datetime({ offset: true }).optional(),
});

/** Everything under `/api/w/:slug`. Membership is checked once here for every child route. */
export const workspaceRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireWorkspace());

  app.get('/', async (request) => {
    const ctx = wctx(request);
    return { workspace: mapWorkspace(ctx.workspace), role: ctx.role };
  });

  app.patch('/', { preHandler: requirePermission('workspace.manage') }, async (request) => {
    const input = parse(updateWorkspaceSchema, request.body);
    return { workspace: await updateWorkspace(wctx(request), input) };
  });

  app.get('/dashboard', async (request) => {
    const { range } = parse(dashboardQuerySchema, request.query);
    return dashboard(wctx(request), range);
  });

  app.get('/activity', async (request) => {
    const query = parse(activityQuerySchema, request.query);
    const ctx = wctx(request);
    return {
      items: await listActivity(ctx, ctx.workspace.id, {
        limit: query.limit,
        before: query.before,
      }),
    };
  });

  app.get('/search', async (request) => {
    const { q } = parse(searchQuerySchema, request.query);
    return search(wctx(request), q);
  });

  app.get('/calendar', async (request) => {
    const { month } = parse(monthQuerySchema, request.query);
    return calendarMonth(wctx(request), month);
  });

  await app.register(memberRoutes);
  await app.register(clientRoutes);
  await app.register(projectRoutes);
  await app.register(timeEntryRoutes);
  await app.register(taxRateRoutes);
  await app.register(invoiceRoutes);
  await app.register(paymentRoutes);
  await app.register(expenseRoutes);
  await app.register(accountRoutes);
  await app.register(journalRoutes);
  await app.register(reportRoutes);
  await app.register(approvalRoutes);
  await app.register(notificationRoutes);
};
