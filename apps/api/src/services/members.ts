import {
  assignableRoles,
  type InviteDto,
  type InviteMemberInput,
  type MemberDto,
  type Role,
  type WorkspaceSummary,
} from '@ledgerline/shared';
import { sql } from 'kysely';
import { conflict, fieldError, forbidden, notFound } from '../errors';
import { newId, newToken } from '../lib/ids';
import { mapInvite, mapMember } from '../mappers';
import { logActivity } from './activity';
import {
  toWorkspaceRecord,
  withTransaction,
  type Ctx,
  type UserRow,
  type WorkspaceCtx,
} from './context';
import { notify } from './notifications';
import { summaryFor } from './workspaces';

export async function listMembers(
  ctx: WorkspaceCtx,
): Promise<{ items: MemberDto[]; invites: InviteDto[] }> {
  const [members, invites] = await Promise.all([
    ctx.db
      .selectFrom('memberships as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .select(['m.user_id', 'u.name', 'u.email', 'm.role', 'm.created_at'])
      .where('m.workspace_id', '=', ctx.workspace.id)
      .orderBy('m.created_at')
      .orderBy(sql`m.rowid`)
      .execute(),
    ctx.db
      .selectFrom('invites as i')
      .leftJoin('users as u', 'u.id', 'i.invited_by')
      .selectAll('i')
      .select('u.name as invited_by_name')
      .where('i.workspace_id', '=', ctx.workspace.id)
      .where('i.accepted_at', 'is', null)
      .orderBy('i.created_at')
      .execute(),
  ]);
  return { items: members.map(mapMember), invites: invites.map(mapInvite) };
}

export async function inviteMember(
  ctx: WorkspaceCtx,
  input: InviteMemberInput,
): Promise<InviteDto> {
  return withTransaction(ctx, async (tx) => {
    if (!assignableRoles(tx.role).includes(input.role))
      throw forbidden(`You cannot invite ${input.role}s`);
    const email = input.email.trim().toLowerCase();
    const member = await tx.db
      .selectFrom('memberships as m')
      .innerJoin('users as u', 'u.id', 'm.user_id')
      .select('m.user_id')
      .where('m.workspace_id', '=', tx.workspace.id)
      .where('u.email', '=', email)
      .executeTakeFirst();
    if (member)
      throw conflict('That person is already a member', [
        { path: 'email', message: 'Already a member' },
      ]);
    const pending = await tx.db
      .selectFrom('invites')
      .select('id')
      .where('workspace_id', '=', tx.workspace.id)
      .where('email', '=', email)
      .where('accepted_at', 'is', null)
      .executeTakeFirst();
    if (pending)
      throw conflict('An invite for that email is already pending', [
        { path: 'email', message: 'Invite already pending' },
      ]);

    const id = newId();
    await tx.db
      .insertInto('invites')
      .values({
        id,
        workspace_id: tx.workspace.id,
        email,
        role: input.role,
        token: newToken(24),
        invited_by: tx.user.id,
        accepted_at: null,
        created_at: tx.clock.now(),
      })
      .execute();
    await logActivity(tx, {
      entityType: 'member',
      entityId: id,
      action: 'invited',
      summary: `${tx.user.name} invited ${email} as ${input.role}`,
      meta: { email, role: input.role },
    });
    const row = await tx.db
      .selectFrom('invites as i')
      .leftJoin('users as u', 'u.id', 'i.invited_by')
      .selectAll('i')
      .select('u.name as invited_by_name')
      .where('i.id', '=', id)
      .executeTakeFirstOrThrow();
    return mapInvite(row);
  });
}

export async function deleteInvite(ctx: WorkspaceCtx, inviteId: string): Promise<void> {
  const result = await ctx.db
    .deleteFrom('invites')
    .where('id', '=', inviteId)
    .where('workspace_id', '=', ctx.workspace.id)
    .where('accepted_at', 'is', null)
    .executeTakeFirst();
  if (Number(result.numDeletedRows) === 0) throw notFound('Invite');
}

/** Accept an invite token on behalf of `user`, creating the membership. */
export async function acceptInvite(
  ctx: Ctx,
  user: UserRow,
  token: string,
): Promise<WorkspaceSummary> {
  return withTransaction(ctx, async (tx) => {
    const invite = await tx.db
      .selectFrom('invites')
      .selectAll()
      .where('token', '=', token)
      .executeTakeFirst();
    if (!invite || invite.accepted_at) throw notFound('Invite');
    const wsRow = await tx.db
      .selectFrom('workspaces')
      .selectAll()
      .where('id', '=', invite.workspace_id)
      .executeTakeFirstOrThrow();
    const workspace = toWorkspaceRecord(wsRow);
    const existing = await tx.db
      .selectFrom('memberships')
      .select('role')
      .where('workspace_id', '=', workspace.id)
      .where('user_id', '=', user.id)
      .executeTakeFirst();
    const now = tx.clock.now();
    await tx.db
      .updateTable('invites')
      .set({ accepted_at: now })
      .where('id', '=', invite.id)
      .execute();
    if (existing) return summaryFor(tx, workspace.id, existing.role);

    await tx.db
      .insertInto('memberships')
      .values({ workspace_id: workspace.id, user_id: user.id, role: invite.role, created_at: now })
      .execute();
    const wctx: WorkspaceCtx = { ...tx, workspace, user, role: invite.role };
    await logActivity(wctx, {
      entityType: 'member',
      entityId: user.id,
      action: 'joined',
      summary: `${user.name} joined ${workspace.name} as ${invite.role}`,
      meta: { role: invite.role },
    });
    const admins = await tx.db
      .selectFrom('memberships')
      .select('user_id')
      .where('workspace_id', '=', workspace.id)
      .where('role', 'in', ['owner', 'admin'])
      .where('user_id', '!=', user.id)
      .execute();
    await notify(wctx, {
      userIds: admins.map((a) => a.user_id),
      kind: 'member_joined',
      title: `${user.name} joined the workspace`,
      body: `${user.name} accepted the invitation and joined as ${invite.role}.`,
      link: `/w/${workspace.slug}/settings`,
    });
    return summaryFor(tx, workspace.id, invite.role);
  });
}

async function memberRow(ctx: WorkspaceCtx, userId: string) {
  return ctx.db
    .selectFrom('memberships as m')
    .innerJoin('users as u', 'u.id', 'm.user_id')
    .select(['m.user_id', 'u.name', 'u.email', 'm.role', 'm.created_at'])
    .where('m.workspace_id', '=', ctx.workspace.id)
    .where('m.user_id', '=', userId)
    .executeTakeFirst();
}

async function ownerCount(ctx: WorkspaceCtx): Promise<number> {
  const { c } = await ctx.db
    .selectFrom('memberships')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('workspace_id', '=', ctx.workspace.id)
    .where('role', '=', 'owner')
    .executeTakeFirstOrThrow();
  return Number(c);
}

/**
 * Change a member's role. Owners can only be touched by other owners, and a workspace must always
 * keep at least one owner.
 */
export async function updateMemberRole(
  ctx: WorkspaceCtx,
  userId: string,
  role: Role,
): Promise<MemberDto> {
  return withTransaction(ctx, async (tx) => {
    const target = await memberRow(tx, userId);
    if (!target) throw notFound('Member');
    if (target.role === 'owner' && tx.role !== 'owner')
      throw forbidden('Only an owner can change another owner');
    if (!assignableRoles(tx.role).includes(role))
      throw forbidden(`You cannot assign the ${role} role`);
    if (target.role === 'owner' && role !== 'owner' && (await ownerCount(tx)) <= 1) {
      throw fieldError('role', 'A workspace needs at least one owner');
    }
    await tx.db
      .updateTable('memberships')
      .set({ role })
      .where('workspace_id', '=', tx.workspace.id)
      .where('user_id', '=', userId)
      .execute();
    await logActivity(tx, {
      entityType: 'member',
      entityId: userId,
      action: 'role_changed',
      summary: `${tx.user.name} changed ${target.name}'s role from ${target.role} to ${role}`,
      meta: { from: target.role, to: role },
    });
    const updated = await memberRow(tx, userId);
    if (!updated) throw notFound('Member');
    return mapMember(updated);
  });
}

/** Remove a member (or leave, when `userId` is the caller). */
export async function removeMember(ctx: WorkspaceCtx, userId: string): Promise<void> {
  return withTransaction(ctx, async (tx) => {
    const target = await memberRow(tx, userId);
    if (!target) throw notFound('Member');
    const self = userId === tx.user.id;
    if (!self && tx.role !== 'owner' && tx.role !== 'admin') throw forbidden();
    if (target.role === 'owner' && tx.role !== 'owner')
      throw forbidden('Only an owner can remove another owner');
    if (target.role === 'owner' && (await ownerCount(tx)) <= 1) {
      throw fieldError('userId', 'The last owner cannot leave the workspace');
    }
    await tx.db
      .deleteFrom('memberships')
      .where('workspace_id', '=', tx.workspace.id)
      .where('user_id', '=', userId)
      .execute();
    await logActivity(tx, {
      entityType: 'member',
      entityId: userId,
      action: self ? 'left' : 'removed',
      summary: self
        ? `${tx.user.name} left the workspace`
        : `${tx.user.name} removed ${target.name} from the workspace`,
      meta: { role: target.role },
    });
  });
}
