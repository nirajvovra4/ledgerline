import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  approvedInvoice,
  createClient,
  createFixture,
  createProject,
  type Fixture,
} from './helpers';

describe('clients', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(() => f.close());

  it('creates a client with defaults and returns it with aggregates', async () => {
    const res = await f.post('/clients', {
      name: 'Aldergrove Botanic Gardens',
      email: 'hello@aldergrove.ca',
      country: 'Canada',
      paymentTermsDays: 45,
    });
    expect(res.status).toBe(201);
    expect(res.body.client).toMatchObject({
      name: 'Aldergrove Botanic Gardens',
      country: 'Canada',
      paymentTermsDays: 45,
      status: 'active',
      company: '',
      outstandingCents: 0,
      invoiceCount: 0,
      projectCount: 0,
    });
  });

  it('validates input', async () => {
    const res = await f.post('/clients', { name: '', email: 'bad', paymentTermsDays: 900 });
    expect(res.status).toBe(400);
    expect(res.body.error.details.map((d: { path: string }) => d.path)).toEqual(
      expect.arrayContaining(['name', 'email', 'paymentTermsDays']),
    );
  });

  it('searches, sorts and paginates', async () => {
    await createClient(f, { name: 'Fenwick & Daughters', company: 'Fenwick Ltd' });
    await createClient(f, { name: 'Meridian Transit Authority' });
    await createClient(f, { name: 'Halcyon Coffee Roasters', email: 'beans@halcyon.test' });

    const byName = await f.get('/clients');
    expect(byName.body.items.map((c: { name: string }) => c.name)).toEqual([
      'Aldergrove Botanic Gardens',
      'Fenwick & Daughters',
      'Halcyon Coffee Roasters',
      'Meridian Transit Authority',
    ]);
    expect(byName.body).toMatchObject({ total: 4, page: 1, pageSize: 25 });

    const q = await f.get('/clients?q=fenwick');
    expect(q.body.total).toBe(1);
    const byCompany = await f.get('/clients?q=LTD');
    expect(byCompany.body.items[0].name).toBe('Fenwick & Daughters');
    const byEmail = await f.get('/clients?q=beans@');
    expect(byEmail.body.items[0].name).toBe('Halcyon Coffee Roasters');

    const page2 = await f.get('/clients?pageSize=2&page=2&sort=name&dir=desc');
    expect(page2.body.items.map((c: { name: string }) => c.name)).toEqual([
      'Fenwick & Daughters',
      'Aldergrove Botanic Gardens',
    ]);
    expect(page2.body).toMatchObject({ total: 4, page: 2, pageSize: 2 });

    const unknownSort = await f.get('/clients?sort=hack');
    expect(unknownSort.status).toBe(200);
  });

  it('updates, archives (via DELETE) and filters by status', async () => {
    const client = await createClient(f, { name: 'Temporary' });
    const patch = await f.patch(`/clients/${client.id}`, { notes: 'VIP', paymentTermsDays: 7 });
    expect(patch.status).toBe(200);
    expect(patch.body.client).toMatchObject({
      notes: 'VIP',
      paymentTermsDays: 7,
      name: 'Temporary',
    });

    const del = await f.del(`/clients/${client.id}`);
    expect(del.status).toBe(200);
    expect(del.body.client.status).toBe('archived');
    expect(
      (await f.get('/clients')).body.items.some((c: { id: string }) => c.id === client.id),
    ).toBe(false);
    expect(
      (await f.get('/clients?status=archived')).body.items.map((c: { id: string }) => c.id),
    ).toEqual([client.id]);
    expect((await f.get('/clients?status=all')).body.total).toBe(5);
    expect((await f.get('/clients/00000000-0000-4000-8000-000000000000')).status).toBe(404);
  });

  it('detail includes stats, projects and invoices', async () => {
    const client = await createClient(f, { name: 'Detail Co', paymentTermsDays: 30 });
    const project = await createProject(f, client.id, { hourlyRateCents: 10000 });
    await f.post('/time-entries', {
      projectId: project.id,
      date: '2026-06-02',
      minutes: 90,
      billable: true,
    });
    const invoice = await approvedInvoice(f, {
      clientId: client.id,
      projectId: project.id,
      dueDate: '2026-06-15',
      lines: [{ description: 'Work', quantity: 1, unitPriceCents: 50000 }],
    });
    await f.post(`/invoices/${invoice.id}/payments`, {
      date: '2026-06-10',
      amountCents: 20000,
      method: 'bank_transfer',
    });

    const res = await f.get(`/clients/${client.id}`);
    expect(res.status).toBe(200);
    expect(res.body.client).toMatchObject({
      invoiceCount: 1,
      projectCount: 1,
      outstandingCents: 30000,
    });
    expect(res.body.stats).toMatchObject({
      invoicedCents: 50000,
      paidCents: 20000,
      outstandingCents: 30000,
      overdueCents: 30000,
      invoiceCount: 1,
      unbilledMinutes: 90,
      unbilledCents: 15000,
    });
    expect(res.body.projects.map((p: { id: string }) => p.id)).toEqual([project.id]);
    expect(res.body.invoices[0]).toMatchObject({
      id: invoice.id,
      derivedStatus: 'overdue',
      balanceCents: 30000,
    });
  });
});
