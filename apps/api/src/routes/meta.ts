import type { MetaDto } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';

export const metaRoutes: FastifyPluginAsync<{ version: string }> = async (app, options) => {
  app.get('/meta', async (): Promise<MetaDto> => {
    const clock = app.ctx.clock;
    return { today: clock.today(), version: options.version, fixedClock: clock.fixed };
  });
};
