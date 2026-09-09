import { notificationListQuerySchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import { listNotifications, markAllRead, markRead } from '../services/notifications';

export const notificationRoutes: FastifyPluginAsync = async (app) => {
  app.get('/notifications', async (request) => {
    const query = parse(notificationListQuerySchema, request.query);
    return listNotifications(wctx(request), query);
  });

  app.post('/notifications/read-all', async (request) => ({
    ok: true,
    updated: await markAllRead(wctx(request)),
  }));

  app.post<{ Params: { id: string } }>('/notifications/:id/read', async (request) => ({
    notification: await markRead(wctx(request), request.params.id),
  }));
};
