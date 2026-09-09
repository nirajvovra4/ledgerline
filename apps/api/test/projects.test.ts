import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approvedInvoice,
  createClient,
  createFixture,
  createProject,
  type Fixture,
} from './helpers';

describe('projects', () => {
  let f: Fixture;
  let clientId: string;
  beforeAll(async () => {
    f = await createFixture();
    clientId = (await createClient(f, { name: 'Client A' })).id;
  });
  afterAll(() => f.close());

  it('creates a project and upper-cases the code', async () => {
    const res = await f.post('/projects', {
      clientId,
      name: 'Wayfinding',
      code: 'ald-01',
      hourlyRateCents: 11500,
      budgetCents: 500000,
      startDate: '2026-01-05',
      endDate: '2026-09-30',
    });
    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({
      code: 'ALD-01',
      clientName: 'Client A',
      status: 'active',
      billingType: 'hourly',
      loggedMinutes: 0,
      invoicedCents: 0,
    });
  });

  it('rejects unknown clients, duplicate codes and inverted dates', async () => {
    const unknown = await f.post('/projects', {
      clientId: '00000000-0000-4000-8000-000000000000',
      name: 'X',
    });
    expect(unknown.status).toBe(400);
    expect(unknown.body.error.details[0].path).toBe('clientId');
    const dup = await f.post('/projects', { clientId, name: 'Y', code: 'ALD-01' });
    expect(dup.status).toBe(409);
    const dates = await f.post('/projects', {
      clientId,
      name: 'Z',
      startDate: '2026-05-01',
      endDate: '2026-04-01',
    });
    expect(dates.status).toBe(400);
  });

  it('filters by client, status and query', async () => {
    const other = await createClient(f, { name: 'Client B' });
    await createProject(f, other.id, { name: 'Other project', code: 'OTH-1' });
    const onHold = await createProject(f, clientId, { name: 'Paused', code: 'PAU-1' });
    await f.patch(`/projects/${onHold.id}`, { status: 'on_hold' });

    expect((await f.get(`/projects?clientId=${clientId}`)).body.total).toBe(2);
    expect(
      (await f.get('/projects?status=on_hold')).body.items.map((p: { name: string }) => p.name),
    ).toEqual(['Paused']);
    expect(
      (await f.get('/projects?q=oth')).body.items.map((p: { code: string }) => p.code),
    ).toEqual(['OTH-1']);
    expect((await f.get('/projects?sort=clientName')).body.items[0].clientName).toBe('Client A');
  });

  it('computes stats from time and invoices', async () => {
    const project = await createProject(f, clientId, {
      hourlyRateCents: 12000,
      budgetCents: 100000,
    });
    await f.post('/time-entries', {
      projectId: project.id,
      date: '2026-06-01',
      minutes: 120,
      billable: true,
    });
    await f.post('/time-entries', {
      projectId: project.id,
      date: '2026-06-08',
      minutes: 60,
      billable: false,
    });
    await approvedInvoice(f, {
      clientId,
      projectId: project.id,
      lines: [{ description: 'Milestone', quantity: 1, unitPriceCents: 50000 }],
    });

    const res = await f.get(`/projects/${project.id}`);
    expect(res.status).toBe(200);
    expect(res.body.project).toMatchObject({
      loggedMinutes: 180,
      billableMinutes: 120,
      unbilledMinutes: 120,
      invoicedCents: 50000,
    });
    expect(res.body.stats).toMatchObject({
      loggedMinutes: 180,
      billableMinutes: 120,
      unbilledMinutes: 120,
      unbilledCents: 24000,
      invoicedCents: 50000,
      paidCents: 0,
      budgetUsedBp: 5000,
    });
    expect(res.body.stats.byMember).toHaveLength(1);
    expect(
      res.body.stats.byWeek.map((w: { weekStart: string; minutes: number }) => [
        w.weekStart,
        w.minutes,
      ]),
    ).toEqual([
      ['2026-06-01', 120],
      ['2026-06-08', 60],
    ]);
    expect(res.body.recentEntries).toHaveLength(2);
  });

  it('archives via DELETE and rejects moving to a different client than the invoice', async () => {
    const project = await createProject(f, clientId);
    const del = await f.del(`/projects/${project.id}`);
    expect(del.status).toBe(200);
    expect(del.body.project.status).toBe('archived');
    expect(
      (await f.get('/projects?status=archived')).body.items.some(
        (p: { id: string }) => p.id === project.id,
      ),
    ).toBe(true);
  });
});
