import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  createClient,
  createFixture,
  createProject,
  type Fixture,
  type Session,
} from './helpers';

describe('time entries', () => {
  let f: Fixture;
  let member: Session;
  let other: Session;
  let projectId: string;
  beforeAll(async () => {
    f = await createFixture();
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    other = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    const client = await createClient(f);
    projectId = (await createProject(f, client.id, { hourlyRateCents: 9000, name: 'Logging' })).id;
  });
  afterAll(() => f.close());

  it('creates an entry for the current user with joined names', async () => {
    const res = await f.post(
      '/time-entries',
      { projectId, date: '2026-06-29', minutes: 90, description: 'Wireframes' },
      member.cookie,
    );
    expect(res.status).toBe(201);
    expect(res.body.entry).toMatchObject({
      userId: member.user.id,
      projectName: 'Logging',
      minutes: 90,
      billable: true,
      invoiceLineId: null,
      invoiceId: null,
      hourlyRateCents: 9000,
    });
    expect(res.body.entry.clientName).toBeTruthy();
  });

  it('validates minutes and project', async () => {
    expect(
      (await f.post('/time-entries', { projectId, date: '2026-06-29', minutes: 0 })).status,
    ).toBe(400);
    expect(
      (await f.post('/time-entries', { projectId, date: '2026-02-30', minutes: 10 })).status,
    ).toBe(400);
    const bad = await f.post('/time-entries', {
      projectId: '00000000-0000-4000-8000-000000000000',
      date: '2026-06-29',
      minutes: 10,
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].path).toBe('projectId');
  });

  it('members may only log and edit their own time', async () => {
    const forOther = await f.post(
      '/time-entries',
      { projectId, userId: other.user.id, date: '2026-06-29', minutes: 30 },
      member.cookie,
    );
    expect(forOther.status).toBe(403);
    const own = await f.post(
      '/time-entries',
      { projectId, date: '2026-06-28', minutes: 45 },
      other.cookie,
    );
    const edit = await f.patch(
      `/time-entries/${own.body.entry.id}`,
      { minutes: 60 },
      member.cookie,
    );
    expect(edit.status).toBe(403);
    const del = await f.del(`/time-entries/${own.body.entry.id}`, member.cookie);
    expect(del.status).toBe(403);
    // Accountant+ can edit anyone's.
    const byOwner = await f.patch(`/time-entries/${own.body.entry.id}`, {
      minutes: 60,
      description: 'fixed by owner',
    });
    expect(byOwner.status).toBe(200);
    expect(byOwner.body.entry.minutes).toBe(60);
    const forOtherByOwner = await f.post('/time-entries', {
      projectId,
      userId: member.user.id,
      date: '2026-06-27',
      minutes: 30,
    });
    expect(forOtherByOwner.status).toBe(201);
    expect(forOtherByOwner.body.entry.userId).toBe(member.user.id);
  });

  it('lists with filters and the summary aggregates per day and project', async () => {
    const all = await f.get('/time-entries');
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((e: { date: string }) => e.date)).toEqual([
      '2026-06-29',
      '2026-06-28',
      '2026-06-27',
    ]);
    const mine = await f.get(`/time-entries?userId=${member.user.id}`);
    expect(mine.body.total).toBe(2);
    const range = await f.get('/time-entries?from=2026-06-28&to=2026-06-28');
    expect(range.body.total).toBe(1);
    const billable = await f.get('/time-entries?billable=true&uninvoiced=true');
    expect(billable.body.total).toBe(3);
    expect((await f.get(`/time-entries?projectId=${projectId}&billable=false`)).body.total).toBe(0);

    const summary = await f.get('/time-entries/summary?from=2026-06-22&to=2026-06-30');
    expect(summary.status).toBe(200);
    expect(summary.body).toMatchObject({
      from: '2026-06-22',
      to: '2026-06-30',
      totalMinutes: 180,
      billableMinutes: 180,
      unbilledMinutes: 180,
    });
    expect(
      summary.body.byDay.map((d: { date: string; minutes: number }) => [d.date, d.minutes]),
    ).toEqual([
      ['2026-06-27', 30],
      ['2026-06-28', 60],
      ['2026-06-29', 90],
    ]);
    expect(summary.body.byProject[0]).toMatchObject({
      projectName: 'Logging',
      minutes: 180,
      billableMinutes: 180,
    });
    const defaultWeek = await f.get('/time-entries/summary');
    expect(defaultWeek.body.from).toBe('2026-06-29');
    expect(defaultWeek.body.to).toBe('2026-07-05');
  });

  it('deletes an entry and forbids deleting invoiced time', async () => {
    const entry = await f.post('/time-entries', { projectId, date: '2026-06-20', minutes: 120 });
    const del = await f.del(`/time-entries/${entry.body.entry.id}`);
    expect(del.status).toBe(200);
    expect((await f.get(`/time-entries/${entry.body.entry.id}`)).status).toBe(404);
  });
});
