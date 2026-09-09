import { inviteMemberSchema, updateMemberRoleSchema } from '@ledgerline/shared';
import type { FastifyPluginAsync } from 'fastify';
import { requirePermission, wctx } from '../auth/guards';
import { parse } from '../lib/parse';
import {
  deleteInvite,
  inviteMember,
  listMembers,
  removeMember,
  updateMemberRole,
} from '../services/members';

type UserParams = { Params: { userId: string } };

export const memberRoutes: FastifyPluginAsync = async (app) => {
  app.get('/members', async (request) => listMembers(wctx(request)));

  app.post(
    '/members/invite',
    { preHandler: requirePermission('members.manage') },
    async (request, reply) => {
      const input = parse(inviteMemberSchema, request.body);
      return reply.status(201).send({ invite: await inviteMember(wctx(request), input) });
    },
  );

  app.patch<UserParams>(
    '/members/:userId',
    { preHandler: requirePermission('members.manage') },
    async (request) => {
      const { role } = parse(updateMemberRoleSchema, request.body);
      return { member: await updateMemberRole(wctx(request), request.params.userId, role) };
    },
  );

  // Leaving (own userId) is allowed for everyone; removing others requires members.manage.
  app.delete<UserParams>('/members/:userId', async (request) => {
    await removeMember(wctx(request), request.params.userId);
    return { ok: true };
  });

  app.delete<{ Params: { inviteId: string } }>(
    '/invites/:inviteId',
    { preHandler: requirePermission('members.manage') },
    async (request) => {
      await deleteInvite(wctx(request), request.params.inviteId);
      return { ok: true };
    },
  );
};
