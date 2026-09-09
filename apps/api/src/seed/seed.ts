/**
 * Deterministic demo data. Everything goes through the same service functions the API uses, so
 * journal entries, activity, approvals and notifications are exactly what real usage produces.
 * IDs come from a seeded generator and the clock is moved by hand, so two runs are identical.
 */
import {
  addDays,
  applyBp,
  diffDays,
  isWeekend,
  randomToken,
  SeededRandom,
  seededUuid,
  type InvoiceLineInput,
  type InvoiceStatus,
  type Role,
} from '@ledgerline/shared';
import { MutableClock } from '../clock';
import type { Db } from '../db';
import { TABLES_FOR_RESET } from '../db/schema';
import { withIdSource } from '../lib/ids';
import { createAccount } from '../services/accounts';
import { createUser } from '../services/auth';
import { createClient } from '../services/clients';
import type { UserRow, WorkspaceCtx, WorkspaceRecord } from '../services/context';
import {
  approveExpense,
  createExpense,
  payExpense,
  rejectExpense,
  submitExpense,
} from '../services/expenses';
import {
  approveInvoice,
  createInvoice,
  createInvoiceFromTime,
  rejectInvoice,
  sendInvoice,
  submitInvoice,
  voidInvoice,
} from '../services/invoices';
import { createManualEntry, systemAccountId } from '../services/journal';
import { acceptInvite, inviteMember } from '../services/members';
import { recordPayment } from '../services/payments';
import { createProject } from '../services/projects';
import { createTaxRate } from '../services/taxRates';
import { createTimeEntry } from '../services/timeEntries';
import { createWorkspace, loadWorkspace } from '../services/workspaces';
import {
  DEMO_PASSWORD,
  DEMO_TODAY,
  FIXED_LINE_SETS,
  HARBOUR_CLIENTS,
  HARBOUR_PROJECTS,
  NORTHLIGHT_CLIENTS,
  NORTHLIGHT_PROJECTS,
  USERS,
  VENDORS,
  type SeedClient,
  type SeedProject,
  type SeedUser,
} from './data';

export interface SeedOptions {
  log?: (line: string) => void;
  seed?: string;
}

export interface SeedSummary {
  today: string;
  users: Array<{ email: string; roles: string }>;
  workspaces: Array<{ name: string; slug: string }>;
  counts: Record<string, number>;
}

type UserKey = SeedUser['key'];

interface SeedState {
  db: Db;
  rng: SeededRandom;
  clock: MutableClock;
  users: Record<UserKey, UserRow>;
  log: (line: string) => void;
}

interface WorkspaceHandles {
  record: WorkspaceRecord;
  roles: Record<UserKey, Role | null>;
  clientIds: Map<string, string>;
  projects: Map<string, { id: string; def: SeedProject }>;
  accountByCode: Map<string, string>;
  taxRateIds: { standard: string; reduced: string; zero: string };
}

/** Reset every table and load the demo. Returns a summary for the CLI. */
export async function seedDatabase(db: Db, options: SeedOptions = {}): Promise<SeedSummary> {
  const log = options.log ?? (() => undefined);
  const rng = new SeededRandom(options.seed ?? 'ledgerline-demo-2026');
  const idSource = {
    uuid: () => seededUuid(rng),
    token: (bytes: number) => randomToken(bytes * 2, () => rng.next()),
  };

  return withIdSource(idSource, async () => {
    await db.transaction().execute(async (trx) => {
      for (const table of TABLES_FOR_RESET) await trx.deleteFrom(table).execute();
    });
    log('Reset all tables');

    const clock = new MutableClock('2025-01-02');
    const state: SeedState = { db, rng, clock, users: {} as Record<UserKey, UserRow>, log };

    for (const u of USERS) {
      clock.tick(3);
      state.users[u.key] = await createUser(
        { db, clock },
        { name: u.name, email: u.email, password: DEMO_PASSWORD },
        { salt: hex(rng, 16) },
      );
    }
    log(`Created ${USERS.length} users`);

    const northlight = await seedNorthlight(state);
    const harbour = await seedHarbour(state);

    // Older notifications have been read; the last few weeks stay unread for the demo.
    const cutoff = '2026-06-10';
    await db
      .updateTable('notifications')
      .set({ read_at: '2026-06-10T08:00:00.000Z' })
      .where('created_at', '<', cutoff)
      .where('read_at', 'is', null)
      .execute();

    const counts: Record<string, number> = {};
    for (const table of [
      'users',
      'workspaces',
      'clients',
      'projects',
      'time_entries',
      'invoices',
      'payments',
      'expenses',
      'journal_entries',
      'approvals',
      'notifications',
      'activity_log',
    ] as const) {
      const { c } = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll<number>().as('c'))
        .executeTakeFirstOrThrow();
      counts[table] = Number(c);
    }
    log(
      `Seeded: ${Object.entries(counts)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')}`,
    );

    return {
      today: DEMO_TODAY,
      users: USERS.map((u) => ({
        email: u.email,
        roles: [northlight, harbour]
          .map((w) => (w.roles[u.key] ? `${w.record.name}: ${w.roles[u.key]}` : null))
          .filter(Boolean)
          .join(', '),
      })),
      workspaces: [northlight, harbour].map((w) => ({ name: w.record.name, slug: w.record.slug })),
      counts,
    };
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(rng: SeededRandom, bytes: number): string {
  return randomToken(bytes * 2, () => rng.next());
}

function ctxFor(state: SeedState, ws: WorkspaceHandles, key: UserKey): WorkspaceCtx {
  const role = ws.roles[key];
  if (!role) throw new Error(`${key} is not a member of ${ws.record.slug}`);
  return { db: state.db, clock: state.clock, workspace: ws.record, user: state.users[key], role };
}

/** Refresh the cached workspace record (settings change when invoice numbers are allocated). */
async function refresh(state: SeedState, ws: WorkspaceHandles): Promise<void> {
  ws.record = await loadWorkspace({ db: state.db, clock: state.clock }, ws.record.id);
}

function at(state: SeedState, date: string, hour = 9): void {
  state.clock.set(clampDate(date), hour, state.rng.int(0, 59));
}

function clampDate(date: string): string {
  return date > DEMO_TODAY ? DEMO_TODAY : date;
}

function randomWeekday(rng: SeededRandom, from: string, to: string): string {
  const span = Math.max(0, diffDays(from, to));
  for (let i = 0; i < 20; i++) {
    const d = addDays(from, rng.int(0, span));
    if (!isWeekend(d)) return d;
  }
  return from;
}

function monthStart(index: number): string {
  const year = 2025 + Math.floor(index / 12);
  const month = (index % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function roundTo(cents: number, unit: number): number {
  return Math.max(unit, Math.round(cents / unit) * unit);
}

// ---------------------------------------------------------------------------
// Shared workspace scaffolding
// ---------------------------------------------------------------------------

interface ScaffoldOptions {
  name: string;
  slug: string;
  currency: string;
  owner: UserKey;
  members: Array<{ key: UserKey; role: Exclude<Role, 'owner'> }>;
  invoicePrefix: string;
  nextInvoiceNumber: number;
  address: string;
  email: string;
  phone: string;
  openingCapitalCents: number;
  clients: SeedClient[];
  projects: SeedProject[];
  startDate: string;
}

async function scaffoldWorkspace(
  state: SeedState,
  opts: ScaffoldOptions,
): Promise<WorkspaceHandles> {
  const { rng, clock, db } = state;
  at(state, opts.startDate, 8);
  const owner = state.users[opts.owner];
  const created = await createWorkspace(
    { db, clock },
    owner,
    { name: opts.name, slug: opts.slug, currency: opts.currency },
    {
      settings: {
        invoicePrefix: opts.invoicePrefix,
        nextInvoiceNumber: opts.nextInvoiceNumber,
        invoiceNumberPadding: 4,
        defaultPaymentTermsDays: 30,
        requireInvoiceApproval: true,
        requireExpenseApproval: true,
        fiscalYearStartMonth: 1,
        invoiceFooter: 'Payment by bank transfer please. Thank you for working with us.',
        address: opts.address,
        email: opts.email,
        phone: opts.phone,
      },
    },
  );
  const ws: WorkspaceHandles = {
    record: await loadWorkspace({ db, clock }, created.id),
    roles: { ada: null, marcus: null, priya: null },
    clientIds: new Map(),
    projects: new Map(),
    accountByCode: new Map(),
    taxRateIds: { standard: '', reduced: '', zero: '' },
  };
  ws.roles[opts.owner] = 'owner';

  // Members join through the real invite flow so the activity log shows it.
  for (const m of opts.members) {
    clock.tick(15);
    const invite = await inviteMember(ctxFor(state, ws, opts.owner), {
      email: state.users[m.key].email,
      role: m.role,
    });
    clock.tick(60);
    await acceptInvite({ db, clock }, state.users[m.key], invite.token);
    ws.roles[m.key] = m.role;
  }

  // Tax rates: the standard rate is the workspace default.
  const ownerCtx = () => ctxFor(state, ws, opts.owner);
  clock.tick(10);
  const standard = await createTaxRate(ownerCtx(), {
    name: 'VAT 20%',
    rateBp: 2000,
    isDefault: true,
  });
  const reduced = await createTaxRate(ownerCtx(), {
    name: 'Reduced rate 5%',
    rateBp: 500,
    isDefault: false,
  });
  const zero = await createTaxRate(ownerCtx(), { name: 'Zero-rated', rateBp: 0, isDefault: false });
  ws.taxRateIds = { standard: standard.id, reduced: reduced.id, zero: zero.id };
  await refresh(state, ws);

  // Chart of accounts: system accounts plus a few studio-specific sub-accounts.
  const accounts = await db
    .selectFrom('accounts')
    .select(['id', 'code'])
    .where('workspace_id', '=', ws.record.id)
    .execute();
  for (const a of accounts) ws.accountByCode.set(a.code, a.id);
  const extra: Array<{
    code: string;
    name: string;
    type: 'revenue' | 'expense';
    parent: string;
    description: string;
  }> = [
    {
      code: '5110',
      name: 'Cloud hosting',
      type: 'expense',
      parent: '5100',
      description: 'Servers, storage and CDN.',
    },
    {
      code: '5120',
      name: 'Design software',
      type: 'expense',
      parent: '5100',
      description: 'Creative tooling and font licences.',
    },
    {
      code: '5310',
      name: 'Photography',
      type: 'expense',
      parent: '5300',
      description: 'Freelance photographers and studio hire.',
    },
    { code: '5410', name: 'Furniture', type: 'expense', parent: '5400', description: '' },
    {
      code: '4150',
      name: 'Licensing & royalties',
      type: 'revenue',
      parent: '4100',
      description: 'Re-use fees for illustration and photography.',
    },
  ];
  for (const def of extra) {
    clock.tick(2);
    const account = await createAccount(ownerCtx(), {
      code: def.code,
      name: def.name,
      type: def.type,
      parentId: ws.accountByCode.get(def.parent) ?? null,
      description: def.description,
      archived: false,
    });
    ws.accountByCode.set(def.code, account.id);
  }

  // Opening capital.
  clock.tick(30);
  const cash = await systemAccountId({ db, clock }, ws.record.id, 'cash');
  const equity = await systemAccountId({ db, clock }, ws.record.id, 'owner_equity');
  await createManualEntry(ownerCtx(), {
    date: opts.startDate,
    memo: 'Opening balance — owner capital introduced',
    lines: [
      {
        accountId: cash,
        debitCents: opts.openingCapitalCents,
        creditCents: 0,
        description: 'Capital introduced',
      },
      {
        accountId: equity,
        debitCents: 0,
        creditCents: opts.openingCapitalCents,
        description: 'Capital introduced',
      },
    ],
  });

  // Clients and projects, created a little after the workspace opened.
  for (const c of opts.clients) {
    clock.tick(rng.int(20, 240));
    const { key, ...input } = c;
    const client = await createClient(ownerCtx(), { ...input, status: 'active' });
    ws.clientIds.set(key, client.id);
  }
  for (const p of opts.projects) {
    at(state, addDays(p.startDate, -rng.int(2, 12)), rng.int(9, 17));
    const clientId = ws.clientIds.get(p.client);
    if (!clientId) throw new Error(`Unknown client ${p.client}`);
    const project = await createProject(ownerCtx(), {
      clientId,
      name: p.name,
      code: p.code,
      description: p.description,
      status: 'active',
      billingType: p.billingType,
      hourlyRateCents: p.hourlyRateCents,
      budgetCents: p.budgetCents,
      startDate: p.startDate,
      endDate: p.endDate,
    });
    ws.projects.set(p.key, { id: project.id, def: p });
  }
  return ws;
}

/** Log time on each project across its active window. */
async function seedTime(
  state: SeedState,
  ws: WorkspaceHandles,
  perProject: [number, number],
): Promise<number> {
  const { rng, clock } = state;
  let count = 0;
  const entries: Array<{
    date: string;
    user: UserKey;
    projectId: string;
    minutes: number;
    description: string;
    billable: boolean;
  }> = [];
  for (const { id, def } of ws.projects.values()) {
    const end = clampDate(def.endDate ?? DEMO_TODAY);
    const n = rng.int(perProject[0], perProject[1]);
    for (let i = 0; i < n; i++) {
      const user = rng.pick(def.team.filter((u) => ws.roles[u]));
      entries.push({
        date: randomWeekday(rng, def.startDate, end),
        user,
        projectId: id,
        minutes: rng.pick([30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420]),
        description: rng.pick(def.tasks),
        billable: rng.chance(0.88),
      });
    }
  }
  entries.sort((a, b) => a.date.localeCompare(b.date));
  for (const e of entries) {
    at(state, e.date, rng.int(17, 19));
    clock.tick(rng.int(1, 30));
    await createTimeEntry(ctxFor(state, ws, e.user), {
      projectId: e.projectId,
      date: e.date,
      minutes: e.minutes,
      description: e.description,
      billable: e.billable,
    });
    count++;
  }
  return count;
}

interface InvoicePlan {
  issueDate: string;
  status: InvoiceStatus;
  /** Fraction of the total paid for partially paid invoices. */
  partial?: number;
  creator: UserKey;
  approver: UserKey;
  payer: UserKey;
  projectKey?: string;
  fromTime?: boolean;
  discountBp?: number;
  poNumber?: string;
}

async function runInvoicePlan(
  state: SeedState,
  ws: WorkspaceHandles,
  plan: InvoicePlan,
): Promise<void> {
  const { rng, clock, db } = state;
  const projectKeys = [...ws.projects.keys()];
  const projectKey = plan.projectKey ?? rng.pick(projectKeys);
  const project = ws.projects.get(projectKey);
  if (!project) throw new Error(`Unknown project ${projectKey}`);
  const clientId = ws.clientIds.get(project.def.client);
  if (!clientId) throw new Error(`Unknown client ${project.def.client}`);
  const client = NORTHLIGHT_CLIENTS.concat(HARBOUR_CLIENTS).find(
    (c) => c.key === project.def.client,
  );
  const terms = client?.paymentTermsDays ?? 30;

  at(state, plan.issueDate, rng.int(9, 12));
  const creator = ctxFor(state, ws, plan.creator);

  let invoiceId: string;
  let number: string;
  let totalCents: number;
  const uninvoiced = plan.fromTime
    ? await db
        .selectFrom('time_entries')
        .select('id')
        .where('project_id', '=', project.id)
        .where('billable', '=', 1)
        .where('invoice_line_id', 'is', null)
        .where('date', '<=', plan.issueDate)
        .where('date', '>=', addDays(plan.issueDate, -60))
        .orderBy('date')
        .limit(rng.int(4, 12))
        .execute()
    : [];

  if (uninvoiced.length >= 3) {
    const detail = await createInvoiceFromTime(creator, {
      clientId,
      projectId: project.id,
      entryIds: uninvoiced.map((e) => e.id),
      groupBy: rng.pick(['entry', 'day', 'project'] as const),
      issueDate: plan.issueDate,
      dueDate: addDays(plan.issueDate, terms),
    });
    invoiceId = detail.id;
    number = detail.number;
    totalCents = detail.totalCents;
  } else {
    const set = rng.pick(FIXED_LINE_SETS);
    const revenue = ws.accountByCode.get('4000') ?? '';
    const product = ws.accountByCode.get('4100') ?? '';
    const lines: InvoiceLineInput[] = set.map((l, i) => ({
      description: l.description,
      quantity: l.quantity,
      unitPriceCents: roundTo(applyBp(l.unitPriceCents, 10_000 + rng.int(-1500, 1500)), 500),
      taxRateId: rng.chance(0.85) ? ws.taxRateIds.standard : ws.taxRateIds.zero,
      accountId: i > 0 && rng.chance(0.3) ? product : revenue,
    }));
    const detail = await createInvoice(creator, {
      clientId,
      projectId: project.id,
      issueDate: plan.issueDate,
      dueDate: addDays(plan.issueDate, terms),
      discountBp: plan.discountBp ?? 0,
      notes: rng.chance(0.4) ? 'Please quote the invoice number with your payment.' : '',
      terms: `Payment due within ${terms} days of the invoice date.`,
      poNumber:
        plan.poNumber ?? (project.def.client === 'meridian' ? `MTA-${rng.int(10000, 99999)}` : ''),
      lines,
    });
    invoiceId = detail.id;
    number = detail.number;
    totalCents = detail.totalCents;
  }
  if (plan.status === 'draft') return;

  clock.tick(rng.int(5, 90));
  await submitInvoice(creator, invoiceId);
  if (plan.status === 'pending_approval') return;

  // A small share of invoices get bounced once before approval.
  const approver = ctxFor(state, ws, plan.approver);
  if (rng.chance(0.08) && plan.status !== 'void') {
    clock.tick(rng.int(30, 180));
    await rejectInvoice(
      approver,
      invoiceId,
      rng.pick([
        'Wrong PO number — please update.',
        'Rate looks off on line 2, can you check?',
        'Split the print costs onto a separate line.',
      ]),
    );
    clock.tick(rng.int(30, 120));
    await submitInvoice(creator, invoiceId);
  }
  at(state, addDays(plan.issueDate, rng.int(0, 2)), rng.int(9, 17));
  await approveInvoice(approver, invoiceId, rng.chance(0.3) ? 'Looks good.' : '');
  if (plan.status === 'approved') return;

  clock.tick(rng.int(10, 240));
  await sendInvoice(ctxFor(state, ws, rng.chance(0.7) ? plan.approver : plan.creator), invoiceId);
  if (plan.status === 'sent') return;

  if (plan.status === 'void') {
    at(state, clampDate(addDays(plan.issueDate, rng.int(4, 14))), rng.int(9, 17));
    await voidInvoice(
      approver,
      invoiceId,
      rng.pick([
        'Issued against the wrong project — reissued.',
        'Client cancelled the phase before work started.',
        'Duplicate of an earlier invoice.',
      ]),
    );
    return;
  }

  const dueDate = addDays(plan.issueDate, terms);
  const payer = ctxFor(state, ws, plan.payer);
  if (plan.status === 'partially_paid') {
    const payDate = clampDate(addDays(plan.issueDate, rng.int(5, Math.max(6, terms - 2))));
    at(state, payDate, rng.int(9, 16));
    await recordPayment(payer, invoiceId, {
      date: payDate,
      amountCents: roundTo(Math.round(totalCents * (plan.partial ?? 0.5)), 100),
      method: rng.pick(['bank_transfer', 'bank_transfer', 'card']),
      reference: `${number} part 1`,
      note: 'Deposit received; balance to follow.',
    });
    return;
  }

  // Paid: sometimes early, sometimes a little late, occasionally in two instalments.
  const payDate = clampDate(addDays(dueDate, rng.int(-terms + 3, 12)));
  at(state, payDate, rng.int(9, 16));
  if (rng.chance(0.2) && totalCents > 200000) {
    const first = roundTo(Math.round(totalCents * 0.4), 100);
    const firstDate = clampDate(addDays(payDate, -rng.int(5, 15)));
    at(state, firstDate, rng.int(9, 16));
    await recordPayment(payer, invoiceId, {
      date: firstDate,
      amountCents: first,
      method: 'bank_transfer',
      reference: `${number}/1`,
      note: '',
    });
    at(state, payDate, rng.int(9, 16));
    await recordPayment(payer, invoiceId, {
      date: payDate,
      amountCents: totalCents - first,
      method: 'bank_transfer',
      reference: `${number}/2`,
      note: '',
    });
  } else {
    await recordPayment(payer, invoiceId, {
      date: payDate,
      amountCents: totalCents,
      method: rng.pick(['bank_transfer', 'bank_transfer', 'bank_transfer', 'card', 'cheque']),
      reference: rng.chance(0.6) ? `${number}` : `TRF ${rng.int(100000, 999999)}`,
      note: '',
    });
  }
}

interface ExpensePlan {
  date: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'paid' | 'rejected';
  creator: UserKey;
  approver: UserKey;
  dueInDays?: number;
  vendorIndex?: number;
}

async function runExpensePlan(
  state: SeedState,
  ws: WorkspaceHandles,
  plan: ExpensePlan,
): Promise<void> {
  const { rng, clock } = state;
  const vendor = VENDORS[plan.vendorIndex ?? rng.int(0, VENDORS.length - 1)];
  if (!vendor) throw new Error('No vendor');
  const accountId = ws.accountByCode.get(vendor.account);
  if (!accountId) throw new Error(`Unknown account ${vendor.account}`);
  at(state, plan.date, rng.int(9, 17));
  const creator = ctxFor(state, ws, plan.creator);
  const billableProject = rng.chance(0.25) ? rng.pick([...ws.projects.values()]) : null;
  const clientId = billableProject ? (ws.clientIds.get(billableProject.def.client) ?? null) : null;
  const detail = await createExpense(creator, {
    vendor: vendor.vendor,
    description: vendor.description,
    date: plan.date,
    dueDate:
      plan.dueInDays !== undefined
        ? addDays(plan.date, plan.dueInDays)
        : rng.chance(0.6)
          ? addDays(plan.date, rng.pick([14, 30]))
          : null,
    accountId,
    amountCents: roundTo(rng.int(vendor.minCents, vendor.maxCents), 100),
    taxRateId: vendor.taxed ? ws.taxRateIds.standard : null,
    clientId,
    projectId: billableProject?.id ?? null,
    billable: Boolean(billableProject),
    reference: rng.chance(0.5) ? `INV-${rng.int(1000, 99999)}` : '',
    notes: '',
  });
  if (plan.status === 'draft') return;
  clock.tick(rng.int(3, 45));
  await submitExpense(creator, detail.expense.id);
  if (plan.status === 'pending_approval') return;
  const approver = ctxFor(state, ws, plan.approver);
  at(state, clampDate(addDays(plan.date, rng.int(0, 3))), rng.int(9, 17));
  if (plan.status === 'rejected') {
    await rejectExpense(
      approver,
      detail.expense.id,
      rng.pick([
        'No receipt attached.',
        'This should be recharged to the client, not expensed.',
        'Duplicate of last month.',
      ]),
    );
    return;
  }
  await approveExpense(approver, detail.expense.id, '');
  if (plan.status === 'approved') return;
  const payDate = clampDate(addDays(plan.date, rng.int(2, 25)));
  at(state, payDate, rng.int(9, 17));
  await payExpense(approver, detail.expense.id, {
    date: payDate,
    method: rng.pick(['bank_transfer', 'card', 'card', 'bank_transfer']),
    reference: rng.chance(0.4) ? `DD ${rng.int(10000, 99999)}` : '',
  });
}

// ---------------------------------------------------------------------------
// Northlight Studio
// ---------------------------------------------------------------------------

async function seedNorthlight(state: SeedState): Promise<WorkspaceHandles> {
  const { rng, log } = state;
  const ws = await scaffoldWorkspace(state, {
    name: 'Northlight Studio',
    slug: 'northlight-studio',
    currency: 'GBP',
    owner: 'ada',
    members: [
      { key: 'marcus', role: 'accountant' },
      { key: 'priya', role: 'member' },
    ],
    invoicePrefix: 'INV',
    nextInvoiceNumber: 1001,
    address: 'Northlight Studio\n2nd Floor, Marshall Mill\nLeeds LS11 9YJ\nUnited Kingdom',
    email: 'accounts@northlight.studio',
    phone: '+44 113 555 0180',
    openingCapitalCents: 2500000,
    clients: NORTHLIGHT_CLIENTS,
    projects: NORTHLIGHT_PROJECTS,
    startDate: '2025-01-02',
  });
  log(`Workspace ${ws.record.name}: ${ws.clientIds.size} clients, ${ws.projects.size} projects`);

  // A pending invite so the members screen has something to show.
  at(state, '2026-06-22', 10);
  await inviteMember(ctxFor(state, ws, 'ada'), {
    email: 'sam.whitlock@northlight.studio',
    role: 'member',
  });

  const timeCount = await seedTime(state, ws, [14, 24]);
  log(`Logged ${timeCount} time entries`);

  // Invoice plan: month index 0 = Jan 2025 … 17 = Jun 2026.
  const plans: InvoicePlan[] = [];
  const projectKeys = NORTHLIGHT_PROJECTS.map((p) => p.key);
  const activeIn = (month: string) =>
    projectKeys.filter((k) => {
      const def = ws.projects.get(k)?.def;
      return def && def.startDate <= addDays(month, 27) && (def.endDate ?? DEMO_TODAY) >= month;
    });
  const staff: UserKey[] = ['ada', 'marcus', 'priya', 'priya', 'ada'];
  for (let m = 0; m <= 17; m++) {
    const start = monthStart(m);
    const candidates = activeIn(start);
    const statuses = statusesForMonth(m);
    for (const [k, status] of statuses.entries()) {
      const projectKey = candidates.length ? rng.pick(candidates) : rng.pick(projectKeys);
      plans.push({
        issueDate: randomWeekday(rng, start, addDays(start, m === 17 ? 26 : 27)),
        status,
        partial: rng.pick([0.3, 0.4, 0.5, 0.6]),
        creator:
          m === 17 && (status === 'pending_approval' || status === 'draft')
            ? 'priya'
            : rng.pick(staff),
        approver: rng.chance(0.65) ? 'marcus' : 'ada',
        payer:
          m === 17 || m === 16
            ? k % 2 === 0
              ? 'ada'
              : 'marcus'
            : rng.chance(0.75)
              ? 'marcus'
              : 'ada',
        projectKey,
        fromTime: rng.chance(0.55),
        discountBp: rng.chance(0.15) ? rng.pick([500, 1000]) : 0,
      });
    }
  }
  plans.sort((a, b) => a.issueDate.localeCompare(b.issueDate));
  for (const plan of plans) await runInvoicePlan(state, ws, plan);
  await refresh(state, ws);
  log(`Created ${plans.length} invoices`);

  // Expenses.
  const expensePlans: ExpensePlan[] = [];
  for (let m = 0; m <= 17; m++) {
    const start = monthStart(m);
    const list = expenseStatusesForMonth(m);
    for (const status of list) {
      expensePlans.push({
        date: randomWeekday(rng, start, addDays(start, m === 17 ? 26 : 27)),
        status,
        creator:
          status === 'pending_approval' || status === 'draft'
            ? 'priya'
            : rng.pick(['ada', 'marcus', 'priya'] as const),
        approver: rng.chance(0.7) ? 'marcus' : 'ada',
        dueInDays: status === 'approved' ? rng.pick([-10, 7, 14, 21]) : undefined,
      });
    }
  }
  expensePlans.sort((a, b) => a.date.localeCompare(b.date));
  for (const plan of expensePlans) await runExpensePlan(state, ws, plan);
  log(`Created ${expensePlans.length} expenses`);

  // A couple of manual journal entries beyond the opening balance.
  const cash = ws.accountByCode.get('1000') ?? '';
  const otherIncome = ws.accountByCode.get('4900') ?? '';
  const equity = ws.accountByCode.get('3000') ?? '';
  at(state, '2025-12-31', 16);
  await createManualEntry(ctxFor(state, ws, 'marcus'), {
    date: '2025-12-31',
    memo: 'Bank interest received — Q4 2025',
    lines: [
      { accountId: cash, debitCents: 18450, creditCents: 0, description: 'Interest' },
      { accountId: otherIncome, debitCents: 0, creditCents: 18450, description: 'Interest' },
    ],
  });
  at(state, '2026-04-30', 15);
  await createManualEntry(ctxFor(state, ws, 'ada'), {
    date: '2026-04-30',
    memo: 'Owner drawings — April 2026',
    lines: [
      { accountId: equity, debitCents: 400000, creditCents: 0, description: 'Drawings' },
      { accountId: cash, debitCents: 0, creditCents: 400000, description: 'Drawings' },
    ],
  });

  // Mark the completed/archived/on-hold projects and the archived client through the normal services.
  at(state, '2026-06-01', 10);
  const { updateProject } = await import('../services/projects');
  const { updateClient } = await import('../services/clients');
  for (const { id, def } of ws.projects.values()) {
    if (def.status !== 'active') {
      at(state, clampDate(addDays(def.endDate ?? '2026-05-15', 3)), 11);
      await updateProject(ctxFor(state, ws, 'ada'), id, { status: def.status });
    }
  }
  for (const c of NORTHLIGHT_CLIENTS) {
    if (c.status === 'archived') {
      at(state, '2025-09-12', 14);
      await updateClient(ctxFor(state, ws, 'ada'), ws.clientIds.get(c.key) ?? '', {
        status: 'archived',
      });
    }
  }
  return ws;
}

/** Target statuses per month so every state appears and the aging buckets are all populated. */
function statusesForMonth(m: number): InvoiceStatus[] {
  switch (m) {
    case 3:
      return ['paid', 'void', 'paid', 'paid'];
    case 9:
      return ['paid', 'sent', 'paid'];
    case 11:
      return ['partially_paid', 'paid', 'paid', 'paid'];
    case 12:
      return ['paid', 'paid', 'sent', 'paid'];
    case 13:
      return ['paid', 'partially_paid', 'paid', 'sent'];
    case 14:
      return ['paid', 'sent', 'paid', 'void'];
    case 15:
      return ['paid', 'sent', 'partially_paid', 'paid'];
    case 16:
      return ['sent', 'sent', 'paid', 'approved', 'paid'];
    case 17:
      return [
        'draft',
        'pending_approval',
        'approved',
        'sent',
        'draft',
        'pending_approval',
        'sent',
        'paid',
      ];
    default:
      return m % 2 === 0 ? ['paid', 'paid', 'paid'] : ['paid', 'paid', 'paid', 'paid'];
  }
}

function expenseStatusesForMonth(m: number): ExpensePlan['status'][] {
  switch (m) {
    case 8:
      return ['paid', 'rejected', 'paid'];
    case 14:
      return ['paid', 'approved', 'paid'];
    case 16:
      return ['paid', 'approved', 'pending_approval', 'paid'];
    case 17:
      return [
        'draft',
        'pending_approval',
        'approved',
        'paid',
        'draft',
        'rejected',
        'paid',
        'pending_approval',
      ];
    default:
      return m % 3 === 0 ? ['paid', 'paid', 'paid'] : ['paid', 'paid'];
  }
}

// ---------------------------------------------------------------------------
// Harbour & Co — a second, smaller workspace where Marcus is the owner
// ---------------------------------------------------------------------------

async function seedHarbour(state: SeedState): Promise<WorkspaceHandles> {
  const { rng, log } = state;
  const ws = await scaffoldWorkspace(state, {
    name: 'Harbour & Co',
    slug: 'harbour-and-co',
    currency: 'EUR',
    owner: 'marcus',
    members: [{ key: 'ada', role: 'admin' }],
    invoicePrefix: 'HC',
    nextInvoiceNumber: 240,
    address: 'Harbour & Co\n11 Sir John Rogerson’s Quay\nDublin D02 VF60\nIreland',
    email: 'studio@harbourandco.ie',
    phone: '+353 1 555 0177',
    openingCapitalCents: 800000,
    clients: HARBOUR_CLIENTS,
    projects: HARBOUR_PROJECTS,
    startDate: '2025-09-01',
  });
  const timeCount = await seedTime(state, ws, [8, 14]);
  const plans: InvoicePlan[] = [
    {
      issueDate: '2025-10-17',
      status: 'paid',
      creator: 'marcus',
      approver: 'ada',
      payer: 'marcus',
      projectKey: 'cop-cans',
      fromTime: true,
    },
    {
      issueDate: '2025-12-05',
      status: 'paid',
      creator: 'ada',
      approver: 'marcus',
      payer: 'marcus',
      projectKey: 'cop-taproom',
    },
    {
      issueDate: '2026-02-13',
      status: 'paid',
      creator: 'marcus',
      approver: 'ada',
      payer: 'ada',
      projectKey: 'cop-cans',
      fromTime: true,
    },
    {
      issueDate: '2026-04-10',
      status: 'partially_paid',
      partial: 0.5,
      creator: 'ada',
      approver: 'marcus',
      payer: 'marcus',
      projectKey: 'dri-brand',
      fromTime: true,
    },
    {
      issueDate: '2026-05-22',
      status: 'sent',
      creator: 'marcus',
      approver: 'ada',
      payer: 'marcus',
      projectKey: 'gla-web',
      fromTime: true,
    },
    {
      issueDate: '2026-06-19',
      status: 'approved',
      creator: 'marcus',
      approver: 'marcus',
      payer: 'marcus',
      projectKey: 'cop-cans',
      fromTime: true,
    },
    {
      issueDate: '2026-06-26',
      status: 'draft',
      creator: 'ada',
      approver: 'marcus',
      payer: 'marcus',
      projectKey: 'dri-brand',
    },
  ];
  for (const plan of plans) await runInvoicePlan(state, ws, plan);
  const expensePlans: ExpensePlan[] = [
    { date: '2025-09-15', status: 'paid', creator: 'marcus', approver: 'marcus', vendorIndex: 1 },
    { date: '2025-11-20', status: 'paid', creator: 'ada', approver: 'marcus', vendorIndex: 6 },
    { date: '2026-02-03', status: 'paid', creator: 'marcus', approver: 'ada', vendorIndex: 0 },
    {
      date: '2026-05-06',
      status: 'approved',
      creator: 'marcus',
      approver: 'marcus',
      vendorIndex: 10,
      dueInDays: 30,
    },
    {
      date: '2026-06-15',
      status: 'pending_approval',
      creator: 'ada',
      approver: 'marcus',
      vendorIndex: 14,
    },
  ];
  for (const plan of expensePlans) await runExpensePlan(state, ws, plan);
  await refresh(state, ws);
  rng.next();
  log(
    `Workspace ${ws.record.name}: ${ws.clientIds.size} clients, ${ws.projects.size} projects, ${timeCount} time entries, ${plans.length} invoices`,
  );
  return ws;
}
