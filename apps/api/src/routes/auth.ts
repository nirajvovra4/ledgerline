import {
  changePasswordSchema,
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { clearSessionCookie, requireUser, setSessionCookie, userOf } from '../auth/guards';
import { parse } from '../lib/parse';
import * as auth from '../services/auth';
import { acceptInvite } from '../services/members';

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post('/auth/register', async (request, reply) => {
    const input = parse(registerSchema, request.body);
    const { user, session } = await auth.register(app.ctx, input);
    setSessionCookie(request, reply, session.token);
    return reply.status(201).send({ user });
  });

  app.post('/auth/login', async (request, reply) => {
    const input = parse(loginSchema, request.body);
    const { user, session } = await auth.login(app.ctx, input);
    setSessionCookie(request, reply, session.token);
    return { user };
  });

  app.post('/auth/logout', async (request, reply) => {
    if (request.sessionToken) await auth.destroySession(app.ctx, request.sessionToken);
    clearSessionCookie(reply);
    return { ok: true };
  });

  app.get('/auth/me', { preHandler: requireUser }, async (request) =>
    auth.me(app.ctx, userOf(request)),
  );

  app.patch('/auth/me', { preHandler: requireUser }, async (request) => {
    const input = parse(updateProfileSchema, request.body);
    return { user: await auth.updateProfile(app.ctx, userOf(request), input) };
  });

  app.post('/auth/password', { preHandler: requireUser }, async (request) => {
    const input = parse(changePasswordSchema, request.body);
    await auth.changePassword(app.ctx, userOf(request), input);
    return { ok: true };
  });

  app.post<{ Params: { token: string } }>(
    '/invites/:token/accept',
    { preHandler: requireUser },
    async (request) => {
      const workspace = await acceptInvite(app.ctx, userOf(request), request.params.token);
      return { workspace };
    },
  );
};
