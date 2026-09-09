/**
 * Shared test scaffolding: an in-memory database with migrations applied, a fixed clock, and
 * helpers for registering users, creating workspaces and making authenticated requests.
 */
import { SESSION_COOKIE, type Role } from '@ledgerline/shared';
import type { FastifyInstance, InjectOptions, LightMyRequestResponse } from 'fastify';
import { buildApp } from '../src/app';
import { FixedClock, type Clock } from '../src/clock';
import { createDb, migrateToLatest, type Db } from '../src/db';

export const TODAY = '2026-06-30';

export interface TestApp {
  app: FastifyInstance;
  db: Db;
  clock: Clock;
  close(): Promise<void>;
}

export async function createTestApp(today = TODAY): Promise<TestApp> {
  const db = createDb(':memory:');
  await migrateToLatest(db);
  const clock = new FixedClock(today);
  const app = await buildApp({ db, clock, version: 'test' });
  await app.ready();
  return {
    app,
    db,
    clock,
    async close() {
      await app.close();
      await db.destroy();
    },
  };
}

export interface Session {
  cookie: string;
  user: { id: string; email: string; name: string };
}

export interface Json {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any;
  headers: LightMyRequestResponse['headers'];
}

/** Perform a JSON request, optionally authenticated, and parse the response body. */
export async function api(
  app: FastifyInstance,
  method: NonNullable<InjectOptions['method']>,
  url: string,
  options: { cookie?: string; body?: unknown } = {},
): Promise<Json> {
  const res = await app.inject({
    method,
    url,
    headers: {
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...(options.body !== undefined ? { 'content-type': 'application/json' } : {}),
    },
    payload: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const text = res.body;
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  return { status: res.statusCode, body, headers: res.headers };
}

function cookieFrom(res: Json): string {
  const raw = res.headers['set-cookie'];
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) throw new Error('No session cookie in response');
  const pair = header.split(';')[0] ?? '';
  if (!pair.startsWith(`${SESSION_COOKIE}=`)) throw new Error(`Unexpected cookie: ${pair}`);
  return pair;
}

let counter = 0;

export async function register(
  app: FastifyInstance,
  overrides: { name?: string; email?: string; password?: string } = {},
): Promise<Session> {
  counter += 1;
  const input = {
    name: overrides.name ?? `Test User ${counter}`,
    email: overrides.email ?? `user${counter}@example.test`,
    password: overrides.password ?? 'password123',
  };
  const res = await api(app, 'POST', '/api/auth/register', { body: input });
  if (res.status !== 201)
    throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { cookie: cookieFrom(res), user: res.body.user };
}

export async function login(
  app: FastifyInstance,
  email: string,
  password = 'password123',
): Promise<Session> {
  const res = await api(app, 'POST', '/api/auth/login', { body: { email, password } });
  if (res.status !== 200)
    throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { cookie: cookieFrom(res), user: res.body.user };
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  currency: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  settings: any;
}

export async function createWorkspace(
  app: FastifyInstance,
  cookie: string,
  overrides: { name?: string; currency?: string; slug?: string } = {},
): Promise<Workspace> {
  counter += 1;
  const res = await api(app, 'POST', '/api/workspaces', {
    cookie,
    body: {
      name: overrides.name ?? `Studio ${counter}`,
      currency: overrides.currency ?? 'GBP',
      slug: overrides.slug ?? `studio-${counter}`,
    },
  });
  if (res.status !== 201)
    throw new Error(`createWorkspace failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.workspace;
}

/** Invite a fresh user into `workspace` with `role` (via the real invite/accept flow). */
export async function addMember(
  app: FastifyInstance,
  ownerCookie: string,
  slug: string,
  role: Exclude<Role, 'owner'>,
  email?: string,
): Promise<Session> {
  counter += 1;
  const memberEmail = email ?? `member${counter}@example.test`;
  const invite = await api(app, 'POST', `/api/w/${slug}/members/invite`, {
    cookie: ownerCookie,
    body: { email: memberEmail, role },
  });
  if (invite.status !== 201)
    throw new Error(`invite failed: ${invite.status} ${JSON.stringify(invite.body)}`);
  const session = await register(app, { email: memberEmail, name: `${role} ${counter}` });
  const accept = await api(app, 'POST', `/api/invites/${invite.body.invite.token}/accept`, {
    cookie: session.cookie,
  });
  if (accept.status !== 200)
    throw new Error(`accept failed: ${accept.status} ${JSON.stringify(accept.body)}`);
  return session;
}

export interface Fixture extends TestApp {
  owner: Session;
  workspace: Workspace;
  slug: string;
  /** Convenience for workspace-scoped requests as the owner. */
  get(url: string, cookie?: string): Promise<Json>;
  post(url: string, body?: unknown, cookie?: string): Promise<Json>;
  patch(url: string, body?: unknown, cookie?: string): Promise<Json>;
  del(url: string, cookie?: string): Promise<Json>;
}

/** The standard fixture: one registered owner with one workspace. */
export async function createFixture(): Promise<Fixture> {
  const t = await createTestApp();
  const owner = await register(t.app, { name: 'Ada Owner' });
  const workspace = await createWorkspace(t.app, owner.cookie, {
    name: 'Northlight Test',
    currency: 'GBP',
  });
  const slug = workspace.slug;
  const base = (url: string) => (url.startsWith('/api') ? url : `/api/w/${slug}${url}`);
  return {
    ...t,
    owner,
    workspace,
    slug,
    get: (url, cookie = owner.cookie) => api(t.app, 'GET', base(url), { cookie }),
    post: (url, body, cookie = owner.cookie) =>
      api(t.app, 'POST', base(url), { cookie, body: body ?? {} }),
    patch: (url, body, cookie = owner.cookie) =>
      api(t.app, 'PATCH', base(url), { cookie, body: body ?? {} }),
    del: (url, cookie = owner.cookie) => api(t.app, 'DELETE', base(url), { cookie }),
  };
}

// ---------------------------------------------------------------------------
// Domain helpers
// ---------------------------------------------------------------------------

export async function accountsByKey(f: Fixture): Promise<Record<string, string>> {
  const res = await f.get('/accounts');
  const out: Record<string, string> = {};
  for (const a of res.body.items) {
    if (a.systemKey) out[a.systemKey] = a.id;
    out[`code:${a.code}`] = a.id;
  }
  return out;
}

export async function createClient(
  f: Fixture,
  overrides: Record<string, unknown> = {},
  cookie?: string,
) {
  counter += 1;
  const res = await f.post(
    '/clients',
    {
      name: `Client ${counter}`,
      email: `client${counter}@example.test`,
      paymentTermsDays: 30,
      ...overrides,
    },
    cookie,
  );
  if (res.status !== 201)
    throw new Error(`createClient failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.client;
}

export async function createProject(
  f: Fixture,
  clientId: string,
  overrides: Record<string, unknown> = {},
  cookie?: string,
) {
  counter += 1;
  const res = await f.post(
    '/projects',
    {
      clientId,
      name: `Project ${counter}`,
      code: `P${counter}`,
      hourlyRateCents: 12000,
      ...overrides,
    },
    cookie,
  );
  if (res.status !== 201)
    throw new Error(`createProject failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.project;
}

export async function createTaxRate(f: Fixture, rateBp = 2000, isDefault = true) {
  const res = await f.post('/tax-rates', { name: `Tax ${rateBp / 100}%`, rateBp, isDefault });
  if (res.status !== 201)
    throw new Error(`createTaxRate failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.taxRate;
}

export interface InvoiceOptions {
  clientId?: string;
  projectId?: string | null;
  issueDate?: string;
  dueDate?: string;
  discountBp?: number;
  lines?: Array<{
    description: string;
    quantity: number;
    unitPriceCents: number;
    taxRateId?: string | null;
    accountId?: string;
  }>;
  cookie?: string;
}

/** Create a draft invoice with sensible defaults (one 10h × £120 line on services revenue). */
export async function createInvoice(f: Fixture, options: InvoiceOptions = {}) {
  const accounts = await accountsByKey(f);
  const clientId = options.clientId ?? (await createClient(f)).id;
  const lines = (
    options.lines ?? [{ description: 'Design services', quantity: 10, unitPriceCents: 12000 }]
  ).map((l) => ({
    taxRateId: null,
    accountId: accounts.services_revenue,
    ...l,
  }));
  const res = await f.post(
    '/invoices',
    {
      clientId,
      projectId: options.projectId ?? null,
      issueDate: options.issueDate ?? '2026-06-01',
      dueDate: options.dueDate ?? '2026-07-01',
      discountBp: options.discountBp ?? 0,
      lines,
    },
    options.cookie,
  );
  if (res.status !== 201)
    throw new Error(`createInvoice failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.invoice;
}

/** Take a draft invoice through submit → approve → send. */
export async function approvedInvoice(f: Fixture, options: InvoiceOptions = {}, send = true) {
  const invoice = await createInvoice(f, options);
  const submit = await f.post(`/invoices/${invoice.id}/submit`);
  if (submit.status !== 200) throw new Error(`submit failed: ${JSON.stringify(submit.body)}`);
  const approve = await f.post(`/invoices/${invoice.id}/approve`, {});
  if (approve.status !== 200) throw new Error(`approve failed: ${JSON.stringify(approve.body)}`);
  if (!send) return approve.body.invoice;
  const sent = await f.post(`/invoices/${invoice.id}/send`);
  if (sent.status !== 200) throw new Error(`send failed: ${JSON.stringify(sent.body)}`);
  return sent.body.invoice;
}

export async function createExpense(
  f: Fixture,
  overrides: Record<string, unknown> = {},
  cookie?: string,
) {
  const accounts = await accountsByKey(f);
  const res = await f.post(
    '/expenses',
    {
      vendor: 'Figma',
      description: 'Team seats',
      date: '2026-06-10',
      accountId: accounts.software_expense,
      amountCents: 10000,
      ...overrides,
    },
    cookie,
  );
  if (res.status !== 201)
    throw new Error(`createExpense failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.expense;
}

export function sumBy<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((s, i) => s + pick(i), 0);
}
