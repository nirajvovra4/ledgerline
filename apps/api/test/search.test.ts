import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createClient,
  createExpense,
  createFixture,
  createInvoice,
  createProject,
  type Fixture,
} from './helpers';

describe('search', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
    const fenwick = await createClient(f, {
      name: 'Fenwick & Daughters',
      company: 'Fenwick Ltd',
      email: 'eleanor@fenwick.test',
    });
    const other = await createClient(f, { name: 'Meridian Transit' });
    await createProject(f, fenwick.id, { name: 'Brand identity', code: 'FEN-01' });
    await createProject(f, other.id, { name: 'Fleet livery', code: 'MER-01' });
    await createInvoice(f, { clientId: fenwick.id });
    await createExpense(f, { vendor: 'Adobe', description: 'Creative Cloud for Fenwick work' });
    for (let i = 0; i < 7; i++) await createClient(f, { name: `Bulk client ${i}` });
  });
  afterAll(() => f.close());

  it('matches across clients, projects, invoices and expenses case-insensitively', async () => {
    const res = await f.get('/search?q=FEN');
    expect(res.status).toBe(200);
    expect(res.body.clients.map((h: { title: string }) => h.title)).toEqual([
      'Fenwick & Daughters',
    ]);
    expect(res.body.projects.map((h: { title: string }) => h.title)).toEqual([
      'FEN-01 · Brand identity',
    ]);
    expect(res.body.invoices).toHaveLength(1);
    expect(res.body.invoices[0]).toMatchObject({
      type: 'invoice',
      subtitle: expect.stringContaining('Fenwick & Daughters'),
    });
    expect(res.body.expenses.map((h: { title: string }) => h.title)).toEqual(['Adobe']);
    expect(res.body.clients[0].link).toBe(`/w/${f.slug}/clients/${res.body.clients[0].id}`);
  });

  it('matches by company/email and caps each group at five', async () => {
    expect((await f.get('/search?q=eleanor@')).body.clients).toHaveLength(1);
    const bulk = await f.get('/search?q=bulk');
    expect(bulk.body.clients).toHaveLength(5);
    expect((await f.get('/search?q=zzz-nothing')).body).toEqual({
      clients: [],
      projects: [],
      invoices: [],
      expenses: [],
    });
  });

  it('requires a query and escapes wildcards', async () => {
    expect((await f.get('/search')).status).toBe(400);
    expect((await f.get('/search?q=%25')).body.clients).toEqual([]);
  });
});
