import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  createClient,
  createExpense,
  createFixture,
  createInvoice,
  type Fixture,
  type Session,
} from './helpers';

describe('approvals queue and notifications', () => {
  let f: Fixture;
  let member: Session;
  let clientId: string;
  beforeAll(async () => {
    f = await createFixture();
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    clientId = (await createClient(f, { name: 'Queue Co' })).id;
  });
  afterAll(() => f.close());

  it('lists pending approvals for invoices and expenses with subject summaries', async () => {
    const inv = await createInvoice(f, {
      clientId,
      cookie: member.cookie,
      lines: [{ description: 'x', quantity: 2, unitPriceCents: 1500 }],
    });
    await f.post(`/invoices/${inv.id}/submit`, {}, member.cookie);
    const exp = await createExpense(
      f,
      { vendor: 'Figma', description: 'Seats', amountCents: 9900 },
      member.cookie,
    );
    await f.post(`/expenses/${exp.id}/submit`, {}, member.cookie);

    const res = await f.get('/approvals');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    const byType = Object.fromEntries(
      res.body.items.map((a: { subjectType: string }) => [a.subjectType, a]),
    );
    expect(byType.invoice).toMatchObject({
      subjectId: inv.id,
      subjectLabel: inv.number,
      subjectCounterparty: 'Queue Co',
      subjectAmountCents: 3000,
      requestedByName: member.user.name,
      status: 'pending',
      decidedBy: null,
    });
    expect(byType.expense).toMatchObject({
      subjectId: exp.id,
      subjectLabel: 'Seats',
      subjectCounterparty: 'Figma',
      subjectAmountCents: 9900,
    });

    await f.post(`/invoices/${inv.id}/approve`, {});
    await f.post(`/expenses/${exp.id}/reject`, { comment: 'Use the studio card' });
    expect((await f.get('/approvals')).body.items).toHaveLength(0);
    expect((await f.get('/approvals?status=approved')).body.items[0].subjectType).toBe('invoice');
    expect((await f.get('/approvals?status=rejected')).body.items[0]).toMatchObject({
      subjectType: 'expense',
      comment: 'Use the studio card',
      decidedByName: 'Ada Owner',
    });
    expect((await f.get('/approvals?status=all')).body.items).toHaveLength(2);
  });

  it('notifications are per user, paginated, and can be marked read individually or all at once', async () => {
    const owner = await f.get('/notifications');
    expect(owner.status).toBe(200);
    // Two approval requests plus the member_joined notice from the fixture.
    expect(owner.body.unreadCount).toBe(3);
    expect(owner.body.items.map((n: { kind: string }) => n.kind)).toEqual([
      'approval_requested',
      'approval_requested',
      'member_joined',
    ]);
    expect(owner.body.items.every((n: { userId: string }) => n.userId === f.owner.user.id)).toBe(
      true,
    );

    const mine = await f.get('/notifications', member.cookie);
    expect(mine.body.unreadCount).toBe(2);
    expect(mine.body.items.map((n: { kind: string }) => n.kind)).toEqual([
      'approval_decided',
      'approval_decided',
    ]);

    const first = owner.body.items[0];
    const read = await f.post(`/notifications/${first.id}/read`);
    expect(read.status).toBe(200);
    expect(read.body.notification.readAt).toBe('2026-06-30T12:00:00.000Z');
    expect((await f.get('/notifications?unread=true')).body).toMatchObject({
      total: 2,
      unreadCount: 2,
    });
    expect((await f.post(`/notifications/${first.id}/read`, {}, member.cookie)).status).toBe(404);

    const all = await f.post('/notifications/read-all');
    expect(all.body).toMatchObject({ ok: true, updated: 2 });
    expect((await f.get('/notifications')).body.unreadCount).toBe(0);
    expect((await f.get('/notifications', member.cookie)).body.unreadCount).toBe(2);
    const page = await f.get('/notifications?pageSize=1&page=2', member.cookie);
    expect(page.body.items).toHaveLength(1);
    expect(page.body).toMatchObject({ total: 2, page: 2, pageSize: 1 });
  });
});
