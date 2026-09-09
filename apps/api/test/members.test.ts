import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, api, createFixture, register, type Fixture, type Session } from './helpers';

describe('members and invites', () => {
  let f: Fixture;
  let accountant: Session;
  let member: Session;
  beforeAll(async () => {
    f = await createFixture();
    accountant = await addMember(f.app, f.owner.cookie, f.slug, 'accountant');
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
  });
  afterAll(() => f.close());

  it('lists members with roles and pending invites', async () => {
    const invite = await f.post('/members/invite', {
      email: 'pending@example.test',
      role: 'member',
    });
    expect(invite.status).toBe(201);
    expect(invite.body.invite).toMatchObject({
      email: 'pending@example.test',
      role: 'member',
      invitedByName: 'Ada Owner',
    });
    expect(invite.body.invite.token).toHaveLength(48);

    const res = await f.get('/members');
    expect(res.status).toBe(200);
    expect(res.body.items.map((m: { role: string }) => m.role).sort()).toEqual([
      'accountant',
      'member',
      'owner',
    ]);
    expect(res.body.invites).toHaveLength(1);

    const del = await f.del(`/invites/${invite.body.invite.id}`);
    expect(del.status).toBe(200);
    expect((await f.get('/members')).body.invites).toHaveLength(0);
  });

  it('rejects inviting an existing member or an owner role', async () => {
    const dup = await f.post('/members/invite', { email: accountant.user.email, role: 'member' });
    expect(dup.status).toBe(409);
    const owner = await f.post('/members/invite', {
      email: 'new-owner@example.test',
      role: 'owner',
    });
    expect(owner.status).toBe(400);
  });

  it('accepting an invite adds the membership and notifies admins', async () => {
    const invite = await f.post('/members/invite', {
      email: 'joiner@example.test',
      role: 'accountant',
    });
    const joiner = await register(f.app, { email: 'joiner@example.test', name: 'Joiner' });
    const accept = await api(f.app, 'POST', `/api/invites/${invite.body.invite.token}/accept`, {
      cookie: joiner.cookie,
    });
    expect(accept.status).toBe(200);
    expect(accept.body.workspace).toMatchObject({ slug: f.slug, role: 'accountant' });
    const again = await api(f.app, 'POST', `/api/invites/${invite.body.invite.token}/accept`, {
      cookie: joiner.cookie,
    });
    expect(again.status).toBe(404);
    const notes = await f.get('/notifications');
    expect(notes.body.items.some((n: { kind: string }) => n.kind === 'member_joined')).toBe(true);
  });

  it('accountants cannot manage members', async () => {
    const invite = await f.post(
      '/members/invite',
      { email: 'x@example.test', role: 'member' },
      accountant.cookie,
    );
    expect(invite.status).toBe(403);
    expect(invite.body.error.code).toBe('forbidden');
    const change = await f.patch(
      `/members/${member.user.id}`,
      { role: 'accountant' },
      accountant.cookie,
    );
    expect(change.status).toBe(403);
    const remove = await f.del(`/members/${member.user.id}`, accountant.cookie);
    expect(remove.status).toBe(403);
  });

  it('owners can change roles but the last owner cannot be demoted or removed', async () => {
    const promote = await f.patch(`/members/${member.user.id}`, { role: 'accountant' });
    expect(promote.status).toBe(200);
    expect(promote.body.member.role).toBe('accountant');
    const demote = await f.patch(`/members/${member.user.id}`, { role: 'member' });
    expect(demote.body.member.role).toBe('member');

    const self = await f.patch(`/members/${f.owner.user.id}`, { role: 'admin' });
    expect(self.status).toBe(400);
    const leave = await f.del(`/members/${f.owner.user.id}`);
    expect(leave.status).toBe(400);
  });

  it('admins cannot touch owners, but a second owner can', async () => {
    const admin = await addMember(f.app, f.owner.cookie, f.slug, 'admin');
    const demoteOwner = await f.patch(
      `/members/${f.owner.user.id}`,
      { role: 'member' },
      admin.cookie,
    );
    expect(demoteOwner.status).toBe(403);
    const makeOwner = await f.patch(`/members/${member.user.id}`, { role: 'owner' }, admin.cookie);
    expect(makeOwner.status).toBe(403);

    const secondOwner = await f.patch(`/members/${admin.user.id}`, { role: 'owner' });
    expect(secondOwner.body.member.role).toBe('owner');
    const nowAllowed = await f.patch(
      `/members/${f.owner.user.id}`,
      { role: 'admin' },
      admin.cookie,
    );
    expect(nowAllowed.status).toBe(200);
    // Restore so later tests keep the original owner.
    expect(
      (await f.patch(`/members/${f.owner.user.id}`, { role: 'owner' }, admin.cookie)).status,
    ).toBe(200);
  });

  it('a member may leave on their own', async () => {
    const leaver = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    const res = await f.del(`/members/${leaver.user.id}`, leaver.cookie);
    expect(res.status).toBe(200);
    const denied = await f.get('/dashboard', leaver.cookie);
    expect(denied.status).toBe(403);
  });
});
