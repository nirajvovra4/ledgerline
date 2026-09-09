import { DEFAULT_WORKSPACE_SETTINGS, SYSTEM_ACCOUNTS } from '@ledgerline/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  api,
  createTestApp,
  createWorkspace,
  register,
  type Session,
  type TestApp,
} from './helpers';

describe('workspaces', () => {
  let t: TestApp;
  let ada: Session;
  beforeAll(async () => {
    t = await createTestApp();
    ada = await register(t.app, { name: 'Ada' });
  });
  afterAll(() => t.close());

  it('creates a workspace with default settings, an owner membership and the system chart of accounts', async () => {
    const res = await api(t.app, 'POST', '/api/workspaces', {
      cookie: ada.cookie,
      body: { name: 'Northlight Studio', currency: 'GBP' },
    });
    expect(res.status).toBe(201);
    const ws = res.body.workspace;
    expect(ws.slug).toBe('northlight-studio');
    expect(ws.settings).toEqual(DEFAULT_WORKSPACE_SETTINGS);

    const list = await api(t.app, 'GET', '/api/workspaces', { cookie: ada.cookie });
    expect(list.body.items).toHaveLength(1);
    expect(list.body.items[0]).toMatchObject({
      slug: 'northlight-studio',
      role: 'owner',
      memberCount: 1,
      currency: 'GBP',
    });

    const accounts = await api(t.app, 'GET', `/api/w/${ws.slug}/accounts`, { cookie: ada.cookie });
    expect(accounts.status).toBe(200);
    expect(accounts.body.items).toHaveLength(SYSTEM_ACCOUNTS.length);
    expect(accounts.body.items.map((a: { code: string }) => a.code)).toEqual(
      SYSTEM_ACCOUNTS.map((a) => a.code),
    );
    expect(
      accounts.body.items.every(
        (a: { isSystem: boolean; balanceCents: number }) => a.isSystem && a.balanceCents === 0,
      ),
    ).toBe(true);
  });

  it('rejects a duplicate slug with 409', async () => {
    const res = await api(t.app, 'POST', '/api/workspaces', {
      cookie: ada.cookie,
      body: { name: 'Another', currency: 'USD', slug: 'northlight-studio' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
  });

  it('validates currency and slug format', async () => {
    const res = await api(t.app, 'POST', '/api/workspaces', {
      cookie: ada.cookie,
      body: { name: 'X', currency: 'XXX', slug: 'Bad Slug!' },
    });
    expect(res.status).toBe(400);
  });

  it('returns the workspace with the caller role, 403 for non-members and 404 for unknown slugs', async () => {
    const mine = await api(t.app, 'GET', '/api/w/northlight-studio', { cookie: ada.cookie });
    expect(mine.status).toBe(200);
    expect(mine.body.role).toBe('owner');
    expect(mine.body.workspace.name).toBe('Northlight Studio');

    const stranger = await register(t.app);
    const theirs = await api(t.app, 'GET', '/api/w/northlight-studio', { cookie: stranger.cookie });
    expect(theirs.status).toBe(403);
    expect(theirs.body.error.code).toBe('forbidden');
    const missing = await api(t.app, 'GET', '/api/w/does-not-exist', { cookie: ada.cookie });
    expect(missing.status).toBe(404);
    const anon = await api(t.app, 'GET', '/api/w/northlight-studio');
    expect(anon.status).toBe(401);
  });

  it('updates settings (merging) and validates the default tax rate', async () => {
    const res = await api(t.app, 'PATCH', '/api/w/northlight-studio', {
      cookie: ada.cookie,
      body: {
        name: 'Northlight',
        settings: { invoicePrefix: 'NL', nextInvoiceNumber: 1042, requireInvoiceApproval: false },
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.workspace.name).toBe('Northlight');
    expect(res.body.workspace.settings).toMatchObject({
      invoicePrefix: 'NL',
      nextInvoiceNumber: 1042,
      requireInvoiceApproval: false,
      invoiceNumberPadding: 4,
    });

    const bad = await api(t.app, 'PATCH', '/api/w/northlight-studio', {
      cookie: ada.cookie,
      body: { settings: { defaultTaxRateId: '00000000-0000-4000-8000-000000000000' } },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].path).toBe('settings.defaultTaxRateId');
  });

  it('lists several workspaces sorted by name', async () => {
    await createWorkspace(t.app, ada.cookie, { name: 'Alpha Co', slug: 'alpha-co' });
    const list = await api(t.app, 'GET', '/api/workspaces', { cookie: ada.cookie });
    expect(list.body.items.map((w: { slug: string }) => w.slug)).toEqual([
      'alpha-co',
      'northlight-studio',
    ]);
  });
});
