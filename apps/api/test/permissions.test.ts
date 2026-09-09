import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  createClient,
  createFixture,
  createInvoice,
  type Fixture,
  type Session,
} from './helpers';

/** The DESIGN.md role table, exercised end-to-end through the routes. */
describe('role permissions', () => {
  let f: Fixture;
  let accountant: Session;
  let member: Session;
  let clientId: string;
  beforeAll(async () => {
    f = await createFixture();
    accountant = await addMember(f.app, f.owner.cookie, f.slug, 'accountant');
    member = await addMember(f.app, f.owner.cookie, f.slug, 'member');
    clientId = (await createClient(f)).id;
  });
  afterAll(() => f.close());

  it('members can view clients but not manage them', async () => {
    expect((await f.get('/clients', member.cookie)).status).toBe(200);
    const create = await f.post('/clients', { name: 'Nope' }, member.cookie);
    expect(create.status).toBe(403);
    expect((await f.patch(`/clients/${clientId}`, { name: 'Renamed' }, member.cookie)).status).toBe(
      403,
    );
  });

  it('accountants can manage clients and projects', async () => {
    expect((await f.post('/clients', { name: 'By accountant' }, accountant.cookie)).status).toBe(
      201,
    );
    expect(
      (
        await f.post(
          '/projects',
          { clientId, name: 'Proj', hourlyRateCents: 1000 },
          accountant.cookie,
        )
      ).status,
    ).toBe(201);
    expect(
      (await f.post('/projects', { clientId, name: 'Proj2', hourlyRateCents: 1000 }, member.cookie))
        .status,
    ).toBe(403);
  });

  it('members may create invoices but not approve, send, void or record payments', async () => {
    const invoice = await createInvoice(f, { clientId, cookie: member.cookie });
    expect(invoice.status).toBe('draft');
    expect((await f.post(`/invoices/${invoice.id}/approve`, {}, member.cookie)).status).toBe(403);
    expect((await f.post(`/invoices/${invoice.id}/send`, {}, member.cookie)).status).toBe(403);
    expect(
      (await f.post(`/invoices/${invoice.id}/void`, { reason: 'x' }, member.cookie)).status,
    ).toBe(403);
    expect(
      (
        await f.post(
          `/invoices/${invoice.id}/payments`,
          { date: '2026-06-01', amountCents: 100, method: 'cash' },
          member.cookie,
        )
      ).status,
    ).toBe(403);
    expect((await f.post(`/invoices/${invoice.id}/submit`, {}, member.cookie)).status).toBe(200);
    expect((await f.post(`/invoices/${invoice.id}/approve`, {}, accountant.cookie)).status).toBe(
      200,
    );
  });

  it('members cannot edit or delete drafts they did not create', async () => {
    const mine = await createInvoice(f, { clientId });
    const del = await f.del(`/invoices/${mine.id}`, member.cookie);
    expect(del.status).toBe(403);
    const edit = await f.patch(
      `/invoices/${mine.id}`,
      {
        clientId,
        issueDate: '2026-06-01',
        dueDate: '2026-07-01',
        lines: [
          { description: 'x', quantity: 1, unitPriceCents: 1, accountId: mine.lines[0].accountId },
        ],
      },
      member.cookie,
    );
    expect(edit.status).toBe(403);
    expect((await f.del(`/invoices/${mine.id}`, accountant.cookie)).status).toBe(200);
  });

  it('ledger and reports are hidden from members', async () => {
    expect((await f.get('/journal', member.cookie)).status).toBe(403);
    expect((await f.get('/reports/profit-loss', member.cookie)).status).toBe(403);
    expect((await f.get('/reports/trial-balance', accountant.cookie)).status).toBe(200);
    expect(
      (await f.post('/journal', { date: '2026-06-01', memo: 'x', lines: [] }, member.cookie))
        .status,
    ).toBe(403);
  });

  it('workspace settings are owner/admin only', async () => {
    expect((await f.patch('/', { name: 'Changed' }, accountant.cookie)).status).toBe(403);
    expect(
      (await f.post('/tax-rates', { name: 'VAT', rateBp: 2000 }, accountant.cookie)).status,
    ).toBe(403);
    expect((await f.patch('/', { name: 'Changed' })).status).toBe(200);
  });

  it('members can see the dashboard, calendar, search and their notifications', async () => {
    expect((await f.get('/dashboard', member.cookie)).status).toBe(200);
    expect((await f.get('/calendar?month=2026-06', member.cookie)).status).toBe(200);
    expect((await f.get('/search?q=a', member.cookie)).status).toBe(200);
    expect((await f.get('/notifications', member.cookie)).status).toBe(200);
    expect((await f.get('/approvals', member.cookie)).status).toBe(200);
  });
});
