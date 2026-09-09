import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createTestApp, type TestApp } from './helpers';

describe('GET /api/meta', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp('2026-06-30');
  });
  afterAll(() => t.close());

  it('reports the fixed clock and version', async () => {
    const res = await api(t.app, 'GET', '/api/meta');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ today: '2026-06-30', version: 'test', fixedClock: true });
  });

  it('does not require authentication', async () => {
    const res = await api(t.app, 'GET', '/api/meta');
    expect(res.status).toBe(200);
  });
});
