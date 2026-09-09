import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  accountsByKey,
  createClient,
  createFixture,
  createProject,
  createTaxRate,
  type Fixture,
} from './helpers';

describe('invoices from time entries', () => {
  let f: Fixture;
  let clientId: string;
  let projectId: string;
  let otherProjectId: string;
  const entryIds: string[] = [];
  beforeAll(async () => {
    f = await createFixture();
    await createTaxRate(f, 2000, true);
    clientId = (await createClient(f, { name: 'Timely Ltd', paymentTermsDays: 14 })).id;
    projectId = (await createProject(f, clientId, { name: 'Retainer', hourlyRateCents: 12000 })).id;
    otherProjectId = (await createProject(f, clientId, { name: 'Side', hourlyRateCents: 8000 })).id;
    for (const [date, minutes] of [
      ['2026-06-01', 90],
      ['2026-06-01', 30],
      ['2026-06-02', 45],
    ] as const) {
      const res = await f.post('/time-entries', {
        projectId,
        date,
        minutes,
        description: 'Design work',
      });
      entryIds.push(res.body.entry.id);
    }
    const side = await f.post('/time-entries', {
      projectId: otherProjectId,
      date: '2026-06-03',
      minutes: 60,
    });
    entryIds.push(side.body.entry.id);
  });
  afterAll(() => f.close());

  it('groups by day, prices at the project rate with the default tax and links the entries', async () => {
    const res = await f.post('/invoices/from-time', {
      clientId,
      projectId,
      entryIds: entryIds.slice(0, 3),
      groupBy: 'day',
    });
    expect(res.status).toBe(201);
    const inv = res.body.invoice;
    const accounts = await accountsByKey(f);
    expect(inv.status).toBe('draft');
    expect(inv.projectId).toBe(projectId);
    expect(inv.issueDate).toBe('2026-06-30');
    expect(inv.dueDate).toBe('2026-07-14');
    expect(inv.lines).toHaveLength(2);
    expect(inv.lines[0]).toMatchObject({
      description: 'Retainer — 2026-06-01',
      quantity: 2,
      unitPriceCents: 12000,
      taxRateBp: 2000,
      accountId: accounts.services_revenue,
      lineTotalCents: 24000,
      taxCents: 4800,
    });
    expect(inv.lines[1]).toMatchObject({
      description: 'Retainer — 2026-06-02',
      quantity: 0.75,
      lineTotalCents: 9000,
    });
    expect(inv.totalCents).toBe(33000 + 6600);

    const entries = await f.get(`/time-entries?projectId=${projectId}`);
    for (const e of entries.body.items) {
      expect(e.invoiceId).toBe(inv.id);
      expect(inv.lines.map((l: { id: string }) => l.id)).toContain(e.invoiceLineId);
    }
    expect((await f.get(`/time-entries?uninvoiced=true`)).body.total).toBe(1);
    const locked = await f.patch(`/time-entries/${entryIds[0]}`, { minutes: 10 });
    expect(locked.status).toBe(409);
  });

  it('rejects already-invoiced entries, entries from another client and non-billable time', async () => {
    const again = await f.post('/invoices/from-time', {
      clientId,
      entryIds: [entryIds[0]],
      groupBy: 'entry',
    });
    expect(again.status).toBe(400);
    expect(again.body.error.details[0].path).toBe('entryIds');
    const otherClient = await createClient(f);
    const wrongClient = await f.post('/invoices/from-time', {
      clientId: otherClient.id,
      entryIds: [entryIds[3]],
      groupBy: 'entry',
    });
    expect(wrongClient.status).toBe(400);
    const nonBillable = await f.post('/time-entries', {
      projectId,
      date: '2026-06-04',
      minutes: 60,
      billable: false,
    });
    const nb = await f.post('/invoices/from-time', {
      clientId,
      entryIds: [nonBillable.body.entry.id],
      groupBy: 'entry',
    });
    expect(nb.status).toBe(400);
    expect(
      (await f.post('/invoices/from-time', { clientId, entryIds: [], groupBy: 'entry' })).status,
    ).toBe(400);
  });

  it('deleting the draft makes the entries unbilled again; grouping by project makes one line', async () => {
    const list = await f.get(`/invoices?status=draft`);
    const draft = list.body.items[0];
    expect((await f.del(`/invoices/${draft.id}`)).status).toBe(200);
    expect((await f.get(`/time-entries?uninvoiced=true&billable=true`)).body.total).toBe(4);

    const res = await f.post('/invoices/from-time', {
      clientId,
      entryIds: entryIds.slice(0, 3),
      groupBy: 'project',
      issueDate: '2026-06-15',
      dueDate: '2026-06-30',
    });
    expect(res.status).toBe(201);
    expect(res.body.invoice.lines).toHaveLength(1);
    expect(res.body.invoice.lines[0]).toMatchObject({
      quantity: 2.75,
      unitPriceCents: 12000,
      lineTotalCents: 33000,
    });
    expect(res.body.invoice).toMatchObject({ issueDate: '2026-06-15', dueDate: '2026-06-30' });
    expect(res.body.invoice.history.map((h: { action: string }) => h.action)).toEqual([
      'created',
      'created_from_time',
    ]);
  });

  it('grouping by entry keeps one line per entry across projects and voiding releases the time', async () => {
    const fresh = await f.post('/time-entries', {
      projectId: otherProjectId,
      date: '2026-06-05',
      minutes: 120,
    });
    const res = await f.post('/invoices/from-time', {
      clientId,
      entryIds: [entryIds[3], fresh.body.entry.id],
      groupBy: 'entry',
    });
    expect(res.status).toBe(201);
    expect(
      res.body.invoice.lines.map((l: { quantity: number; unitPriceCents: number }) => [
        l.quantity,
        l.unitPriceCents,
      ]),
    ).toEqual([
      [1, 8000],
      [2, 8000],
    ]);
    await f.post(`/invoices/${res.body.invoice.id}/approve`, {});
    await f.post(`/invoices/${res.body.invoice.id}/void`, { reason: 'Rebill next month' });
    const entry = await f.get(`/time-entries/${fresh.body.entry.id}`);
    expect(entry.body.entry.invoiceLineId).toBeNull();
  });
});
