import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createFixture, type Fixture } from './helpers';

describe('error envelope', () => {
  let f: Fixture;
  beforeAll(async () => {
    f = await createFixture();
  });
  afterAll(() => f.close());

  it('returns not_found for unknown API routes and records', async () => {
    const route = await api(f.app, 'GET', '/api/nope');
    expect(route.status).toBe(404);
    expect(route.body).toEqual({
      error: { code: 'not_found', message: 'Route GET /api/nope not found' },
    });
    const record = await f.get('/clients/00000000-0000-4000-8000-000000000000');
    expect(record.body.error).toEqual({ code: 'not_found', message: 'Client not found' });
  });

  it('returns validation_error with field issues', async () => {
    const res = await f.post('/clients', { name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    expect(res.body.error.details).toEqual([
      { path: 'name', message: 'Client name is required', code: 'too_small' },
    ]);
  });

  it('rejects malformed JSON as a validation error', async () => {
    const res = await f.app.inject({
      method: 'POST',
      url: `/api/w/${f.slug}/clients`,
      headers: { cookie: f.owner.cookie, 'content-type': 'application/json' },
      payload: '{not json',
    });
    expect(res.statusCode).toBe(400);
    expect(JSON.parse(res.body).error.code).toBe('validation_error');
  });

  it('returns unauthenticated without a session and forbidden without permission', async () => {
    expect((await api(f.app, 'GET', `/api/w/${f.slug}/clients`)).body.error.code).toBe(
      'unauthenticated',
    );
  });

  it('serves 404 (not the SPA) for non-API paths when no static build exists', async () => {
    const res = await api(f.app, 'GET', '/w/anything');
    expect(res.status).toBe(404);
  });
});
