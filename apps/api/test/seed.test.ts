import { buildTrialBalance } from '@ledgerline/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { seedDatabase, type SeedSummary } from '../src/seed/seed';
import { accountList, ledgerLines } from '../src/services/reports';
import { api, createTestApp, login, type TestApp } from './helpers';

describe('demo seed', () => {
  let t: TestApp;
  let summary: SeedSummary;
  beforeAll(async () => {
    t = await createTestApp('2026-06-30');
    summary = await seedDatabase(t.db);
  }, 60_000);
  afterAll(() => t.close());

  it('creates the documented users and workspaces', async () => {
    expect(summary.counts.users).toBe(3);
    expect(summary.counts.workspaces).toBe(2);
    expect(summary.workspaces.map((w) => w.slug)).toEqual(['northlight-studio', 'harbour-and-co']);
    expect(summary.counts.clients).toBeGreaterThanOrEqual(17);
    expect(summary.counts.projects).toBeGreaterThanOrEqual(26);
    expect(summary.counts.time_entries).toBeGreaterThanOrEqual(400);
    expect(summary.counts.invoices).toBeGreaterThanOrEqual(60);
    expect(summary.counts.expenses).toBeGreaterThanOrEqual(45);
    expect(summary.counts.payments).toBeGreaterThanOrEqual(25);
  });

  it('covers every invoice and expense status', async () => {
    const invoiceStatuses = (
      await t.db.selectFrom('invoices').select('status').distinct().execute()
    )
      .map((r) => r.status)
      .sort();
    expect(invoiceStatuses).toEqual([
      'approved',
      'draft',
      'paid',
      'partially_paid',
      'pending_approval',
      'sent',
      'void',
    ]);
    const expenseStatuses = (
      await t.db.selectFrom('expenses').select('status').distinct().execute()
    )
      .map((r) => r.status)
      .sort();
    expect(expenseStatuses).toEqual(['approved', 'draft', 'paid', 'pending_approval', 'rejected']);
    const overdue = await t.db
      .selectFrom('invoices')
      .select((eb) => eb.fn.countAll<number>().as('c'))
      .where('status', 'in', ['sent', 'partially_paid'])
      .where('due_date', '<', '2026-06-30')
      .executeTakeFirstOrThrow();
    expect(Number(overdue.c)).toBeGreaterThanOrEqual(5);
  });

  it('keeps the ledger balanced and every posted invoice has a journal entry', async () => {
    for (const ws of await t.db.selectFrom('workspaces').select('id').execute()) {
      const tb = buildTrialBalance(
        await ledgerLines(t, ws.id),
        await accountList(t, ws.id),
        '2026-06-30',
      );
      expect(tb.balanced).toBe(true);
      expect(tb.totalDebitCents).toBeGreaterThan(0);
    }
    const missing = await t.db
      .selectFrom('invoices as i')
      .select((eb) => eb.fn.countAll<number>().as('c'))
      .where('i.status', 'in', ['approved', 'sent', 'partially_paid', 'paid'])
      .where((eb) =>
        eb.not(
          eb.exists(
            eb
              .selectFrom('journal_entries as e')
              .select('e.id')
              .whereRef('e.source_id', '=', 'i.id')
              .where('e.source_type', '=', 'invoice'),
          ),
        ),
      )
      .executeTakeFirstOrThrow();
    expect(Number(missing.c)).toBe(0);
    const pending = await t.db
      .selectFrom('approvals')
      .select('subject_type')
      .where('status', '=', 'pending')
      .execute();
    expect(new Set(pending.map((p) => p.subject_type))).toEqual(new Set(['invoice', 'expense']));
    const unread = await t.db
      .selectFrom('notifications')
      .select('user_id')
      .distinct()
      .where('read_at', 'is', null)
      .execute();
    expect(unread).toHaveLength(3);
  });

  it('demo credentials work and roles match the design', async () => {
    const ada = await login(t.app, 'ada@northlight.studio', 'password123');
    const me = await api(t.app, 'GET', '/api/auth/me', { cookie: ada.cookie });
    expect(me.body.workspaces.map((w: { slug: string; role: string }) => [w.slug, w.role])).toEqual(
      [
        ['harbour-and-co', 'admin'],
        ['northlight-studio', 'owner'],
      ],
    );
    const marcus = await login(t.app, 'marcus@northlight.studio', 'password123');
    const marcusMe = await api(t.app, 'GET', '/api/auth/me', { cookie: marcus.cookie });
    expect(
      marcusMe.body.workspaces.find((w: { slug: string }) => w.slug === 'northlight-studio').role,
    ).toBe('accountant');
    expect(
      marcusMe.body.workspaces.find((w: { slug: string }) => w.slug === 'harbour-and-co').role,
    ).toBe('owner');
    const priya = await login(t.app, 'priya@northlight.studio', 'password123');
    const priyaMe = await api(t.app, 'GET', '/api/auth/me', { cookie: priya.cookie });
    expect(priyaMe.body.workspaces.map((w: { role: string }) => w.role)).toEqual(['member']);

    const dashboard = await api(t.app, 'GET', '/api/w/northlight-studio/dashboard?range=quarter', {
      cookie: ada.cookie,
    });
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.kpis.overdueCount).toBeGreaterThan(0);
    expect(dashboard.body.aging.every((b: { amountCents: number }) => b.amountCents > 0)).toBe(
      true,
    );
    expect(dashboard.body.topClients.length).toBeGreaterThanOrEqual(3);
    const reports = await api(t.app, 'GET', '/api/w/northlight-studio/reports/balance-sheet', {
      cookie: ada.cookie,
    });
    expect(reports.body.balanced).toBe(true);
  });

  it('is deterministic across runs', async () => {
    const first = (
      await t.db
        .selectFrom('invoices')
        .select(['id', 'number', 'total_cents'])
        .orderBy('number')
        .execute()
    ).slice(0, 5);
    const again = await createTestApp('2026-06-30');
    await seedDatabase(again.db);
    const second = (
      await again.db
        .selectFrom('invoices')
        .select(['id', 'number', 'total_cents'])
        .orderBy('number')
        .execute()
    ).slice(0, 5);
    expect(second).toEqual(first);
    await again.close();
  }, 60_000);
});
