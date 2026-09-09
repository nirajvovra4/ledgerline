import { SESSION_COOKIE } from '@ledgerline/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createTestApp, login, register, type TestApp } from './helpers';

describe('auth', () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('registers a user and sets an httpOnly session cookie', async () => {
    const res = await api(t.app, 'POST', '/api/auth/register', {
      body: { name: 'Ada', email: 'Ada@Example.test', password: 'password123' },
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: 'Ada', email: 'ada@example.test' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password_hash).toBeUndefined();
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toContain(`${SESSION_COOKIE}=`);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Max-Age=/i);
  });

  it('rejects duplicate emails with 409 conflict', async () => {
    const res = await api(t.app, 'POST', '/api/auth/register', {
      body: { name: 'Again', email: 'ada@example.test', password: 'password123' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('conflict');
    expect(res.body.error.details[0].path).toBe('email');
  });

  it('validates the registration body', async () => {
    const res = await api(t.app, 'POST', '/api/auth/register', {
      body: { name: '', email: 'not-an-email', password: 'short' },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_error');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('logs in with the right password and rejects the wrong one', async () => {
    const ok = await api(t.app, 'POST', '/api/auth/login', {
      body: { email: 'ada@example.test', password: 'password123' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.user.email).toBe('ada@example.test');
    const bad = await api(t.app, 'POST', '/api/auth/login', {
      body: { email: 'ada@example.test', password: 'password124' },
    });
    expect(bad.status).toBe(401);
    expect(bad.body.error.code).toBe('unauthenticated');
    const unknown = await api(t.app, 'POST', '/api/auth/login', {
      body: { email: 'nobody@example.test', password: 'password123' },
    });
    expect(unknown.status).toBe(401);
  });

  it('returns the current user and workspaces from /me', async () => {
    const session = await login(t.app, 'ada@example.test');
    const me = await api(t.app, 'GET', '/api/auth/me', { cookie: session.cookie });
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('ada@example.test');
    expect(me.body.workspaces).toEqual([]);
  });

  it('requires a session for /me', async () => {
    const res = await api(t.app, 'GET', '/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
    const bogus = await api(t.app, 'GET', '/api/auth/me', { cookie: `${SESSION_COOKIE}=deadbeef` });
    expect(bogus.status).toBe(401);
  });

  it('logs out and invalidates the session', async () => {
    const session = await login(t.app, 'ada@example.test');
    const out = await api(t.app, 'POST', '/api/auth/logout', { cookie: session.cookie });
    expect(out.status).toBe(200);
    expect(out.body).toEqual({ ok: true });
    const me = await api(t.app, 'GET', '/api/auth/me', { cookie: session.cookie });
    expect(me.status).toBe(401);
  });

  it('updates the profile and rejects an email already in use', async () => {
    const other = await register(t.app, { email: 'taken@example.test' });
    const session = await login(t.app, 'ada@example.test');
    const ok = await api(t.app, 'PATCH', '/api/auth/me', {
      cookie: session.cookie,
      body: { name: 'Ada Okafor', email: 'ada@example.test' },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.user.name).toBe('Ada Okafor');
    const clash = await api(t.app, 'PATCH', '/api/auth/me', {
      cookie: session.cookie,
      body: { name: 'Ada', email: other.user.email },
    });
    expect(clash.status).toBe(409);
  });

  it('changes the password after verifying the current one', async () => {
    const session = await login(t.app, 'ada@example.test');
    const wrong = await api(t.app, 'POST', '/api/auth/password', {
      cookie: session.cookie,
      body: {
        currentPassword: 'nope-nope',
        newPassword: 'newpassword1',
        confirmPassword: 'newpassword1',
      },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.details[0].path).toBe('currentPassword');
    const mismatch = await api(t.app, 'POST', '/api/auth/password', {
      cookie: session.cookie,
      body: {
        currentPassword: 'password123',
        newPassword: 'newpassword1',
        confirmPassword: 'different1',
      },
    });
    expect(mismatch.status).toBe(400);
    const ok = await api(t.app, 'POST', '/api/auth/password', {
      cookie: session.cookie,
      body: {
        currentPassword: 'password123',
        newPassword: 'newpassword1',
        confirmPassword: 'newpassword1',
      },
    });
    expect(ok.status).toBe(200);
    expect(
      (
        await api(t.app, 'POST', '/api/auth/login', {
          body: { email: 'ada@example.test', password: 'newpassword1' },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await api(t.app, 'POST', '/api/auth/login', {
          body: { email: 'ada@example.test', password: 'password123' },
        })
      ).status,
    ).toBe(401);
  });
});
