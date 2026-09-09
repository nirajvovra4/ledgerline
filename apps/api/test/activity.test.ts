import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, createFixture, createInvoice, type Fixture } from './helpers';

describe('activity log', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(() => f.close());

  it('records human-readable summaries for mutations, newest first', async () => {
    const client = await createClient(f, { name: 'Acme' });
    const invoice = await createInvoice(f, { clientId: client.id });
    await f.post(`/invoices/${invoice.id}/submit`);
    await f.post(`/invoices/${invoice.id}/approve`, {});
    const res = await f.get('/activity');
    expect(res.status).toBe(200);
    const summaries = res.body.items.map((a: { summary: string }) => a.summary);
    expect(summaries[0]).toBe(`Ada Owner approved ${invoice.number} for Acme`);
    expect(summaries[1]).toBe(`Ada Owner submitted ${invoice.number} for approval`);
    expect(summaries).toContain('Ada Owner added client Acme');
    expect(summaries[summaries.length - 1]).toBe('Ada Owner created the workspace Northlight Test');
    expect(res.body.items[0]).toMatchObject({
      entityType: 'invoice',
      entityId: invoice.id,
      action: 'approved',
      actorId: f.owner.user.id,
      actorName: 'Ada Owner',
    });
    expect(res.body.items[0].meta.journalEntryId).toBeTruthy();
  });

  it('supports a limit and a before cursor', async () => {
    const two = await f.get('/activity?limit=2');
    expect(two.body.items).toHaveLength(2);
    const cursor = two.body.items[1].createdAt;
    const older = await f.get(`/activity?limit=50&before=${encodeURIComponent(cursor)}`);
    expect(older.body.items.every((a: { createdAt: string }) => a.createdAt < cursor)).toBe(true);
    expect((await f.get('/activity?before=yesterday')).status).toBe(400);
  });
});
