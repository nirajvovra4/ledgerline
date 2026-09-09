import { asOfSchema, dateRangeSchema, profitLossQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  arAging,
  balanceSheet,
  profitLoss,
  revenueByClient,
  taxSummary,
  timeUtilisation,
  trialBalance,
} from '../services/reports';

export const reportRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requirePermission('reports.view'));

  app.get('/reports/profit-loss', async (request) =>
    profitLoss(wctx(request), parse(profitLossQuerySchema, request.query)),
  );
  app.get('/reports/balance-sheet', async (request) =>
    balanceSheet(wctx(request), parse(asOfSchema, request.query).asOf),
  );
  app.get('/reports/trial-balance', async (request) =>
    trialBalance(wctx(request), parse(asOfSchema, request.query).asOf),
  );
  app.get('/reports/ar-aging', async (request) =>
    arAging(wctx(request), parse(asOfSchema, request.query).asOf),
  );
  app.get('/reports/tax-summary', async (request) =>
    taxSummary(wctx(request), parse(dateRangeSchema, request.query)),
  );
  app.get('/reports/revenue-by-client', async (request) =>
    revenueByClient(wctx(request), parse(dateRangeSchema, request.query)),
  );
  app.get('/reports/time-utilisation', async (request) =>
    timeUtilisation(wctx(request), parse(dateRangeSchema, request.query)),
  );
};
