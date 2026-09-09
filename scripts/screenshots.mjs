#!/usr/bin/env node
/**
 * Captures PNG screenshots of the running app for docs/screenshots.
 *
 * Usage:
 *   npm run build && LEDGERLINE_TODAY=2026-06-30 npm run screenshots
 *
 * The script boots the production server on a throw-away seeded SQLite database, logs in with
 * the demo owner account, walks every page (desktop + a few mobile variants, light + dark) and
 * writes PNGs to docs/screenshots. Requires Chromium available to playwright-core: either set
 * PLAYWRIGHT_CHROMIUM_PATH to an executable or have a Playwright browser install on this machine.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const OUT = join(ROOT, 'docs', 'screenshots');
const PORT = Number(process.env.SCREENSHOT_PORT ?? 4700);
const BASE = `http://127.0.0.1:${PORT}`;
const DB = join(ROOT, 'data', 'screenshots.sqlite');
const SLUG = 'northlight-studio';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

/** @type {Array<{ name: string, path: string, viewport?: {width:number,height:number}, dark?: boolean, full?: boolean, before?: (page: import('playwright-core').Page) => Promise<void> }>} */
const SHOTS = [
  { name: '00-login', path: '/login', before: async (page) => page.context().clearCookies() },
  { name: '00-login-error', path: '/login', before: loginError },
  { name: '00-register', path: '/register' },
  { name: '01-workspaces', path: '/workspaces' },
  { name: '02-dashboard', path: `/w/${SLUG}/dashboard`, full: true },
  { name: '02-dashboard-year', path: `/w/${SLUG}/dashboard?range=year`, full: true },
  { name: '02-dashboard-dark', path: `/w/${SLUG}/dashboard`, dark: true, full: true },
  { name: '02-dashboard-mobile', path: `/w/${SLUG}/dashboard`, viewport: MOBILE },
  { name: '03-clients', path: `/w/${SLUG}/clients` },
  { name: '03-clients-search', path: `/w/${SLUG}/clients?q=mer` },
  { name: '03-clients-archived-empty', path: `/w/${SLUG}/clients?status=archived&q=zzzz` },
  { name: '03-client-new', path: `/w/${SLUG}/clients/new`, full: true },
  { name: '03-client-new-validation', path: `/w/${SLUG}/clients/new`, before: submitEmptyForm },
  { name: '03-client-detail', path: `/w/${SLUG}/clients/__CLIENT__`, full: true },
  { name: '03-client-invoices', path: `/w/${SLUG}/clients/__CLIENT__?tab=invoices`, full: true },
  { name: '03-client-statement', path: `/w/${SLUG}/clients/__CLIENT__?tab=statement`, full: true },
  { name: '04-projects', path: `/w/${SLUG}/projects` },
  { name: '04-project-detail', path: `/w/${SLUG}/projects/__PROJECT__`, full: true },
  { name: '04-project-new', path: `/w/${SLUG}/projects/new`, full: true },
  { name: '05-time', path: `/w/${SLUG}/time`, full: true },
  { name: '05-time-mobile', path: `/w/${SLUG}/time`, viewport: MOBILE },
  { name: '06-invoices', path: `/w/${SLUG}/invoices` },
  { name: '06-invoices-overdue', path: `/w/${SLUG}/invoices?status=overdue` },
  { name: '06-invoices-draft', path: `/w/${SLUG}/invoices?status=draft` },
  { name: '06-invoice-new-step1', path: `/w/${SLUG}/invoices/new`, full: true },
  { name: '06-invoice-detail', path: `/w/${SLUG}/invoices/__INVOICE__`, full: true },
  {
    name: '06-invoice-detail-mobile',
    path: `/w/${SLUG}/invoices/__INVOICE__`,
    viewport: MOBILE,
    full: true,
  },
  { name: '06-invoice-print', path: `/w/${SLUG}/invoices/__INVOICE__/print`, full: true },
  { name: '06-invoice-from-time', path: `/w/${SLUG}/invoices/from-time`, full: true },
  { name: '07-payments', path: `/w/${SLUG}/payments` },
  { name: '08-expenses', path: `/w/${SLUG}/expenses` },
  { name: '08-expense-new', path: `/w/${SLUG}/expenses/new`, full: true },
  { name: '08-expense-detail', path: `/w/${SLUG}/expenses/__EXPENSE__`, full: true },
  { name: '09-accounts', path: `/w/${SLUG}/ledger/accounts`, full: true },
  { name: '09-account-register', path: `/w/${SLUG}/ledger/accounts/__ACCOUNT__`, full: true },
  { name: '09-journal', path: `/w/${SLUG}/ledger/journal` },
  { name: '09-journal-entry', path: `/w/${SLUG}/ledger/journal/__JOURNAL__`, full: true },
  { name: '10-reports', path: `/w/${SLUG}/reports` },
  {
    name: '10-report-profit-loss',
    path: `/w/${SLUG}/reports/profit-loss?from=2026-01-01&to=2026-06-30&compare=previous`,
    full: true,
  },
  { name: '10-report-balance-sheet', path: `/w/${SLUG}/reports/balance-sheet`, full: true },
  { name: '10-report-trial-balance', path: `/w/${SLUG}/reports/trial-balance`, full: true },
  { name: '10-report-ar-aging', path: `/w/${SLUG}/reports/ar-aging`, full: true },
  { name: '10-report-tax-summary', path: `/w/${SLUG}/reports/tax-summary`, full: true },
  { name: '10-report-revenue-by-client', path: `/w/${SLUG}/reports/revenue-by-client`, full: true },
  { name: '10-report-time-utilisation', path: `/w/${SLUG}/reports/time-utilisation`, full: true },
  { name: '11-calendar', path: `/w/${SLUG}/calendar?month=2026-06`, full: true },
  { name: '12-approvals', path: `/w/${SLUG}/approvals` },
  { name: '13-notifications', path: `/w/${SLUG}/notifications` },
  { name: '14-settings-general', path: `/w/${SLUG}/settings`, full: true },
  { name: '14-settings-invoicing', path: `/w/${SLUG}/settings?tab=invoicing`, full: true },
  { name: '14-settings-tax-rates', path: `/w/${SLUG}/settings?tab=tax`, full: true },
  { name: '14-settings-members', path: `/w/${SLUG}/settings?tab=members`, full: true },
  { name: '14-settings-profile', path: `/w/${SLUG}/settings?tab=profile`, full: true },
  { name: '15-not-found', path: `/w/${SLUG}/nope` },
];

async function loginError(page) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', 'ada@northlight.studio');
  await page.fill('input[type="password"]', 'wrong-password');
  await page.click('button[type="submit"]');
  await page.waitForTimeout(600);
}

async function submitEmptyForm(page) {
  await page.waitForSelector('form');
  await page.click('form button[type="submit"]');
  await page.waitForTimeout(300);
}

function startServer() {
  rmSync(DB, { force: true });
  rmSync(`${DB}-wal`, { force: true });
  rmSync(`${DB}-shm`, { force: true });
  const child = spawn(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', join(ROOT, 'apps/api/dist/server.js')],
    {
      env: {
        ...process.env,
        PORT: String(PORT),
        DATABASE_PATH: DB,
        LEDGERLINE_TODAY: process.env.LEDGERLINE_TODAY ?? '2026-06-30',
        SEED_IF_EMPTY: 'true',
        STATIC_DIR: join(ROOT, 'apps/web/dist'),
        NODE_ENV: 'production',
      },
      stdio: ['ignore', 'pipe', 'inherit'],
    },
  );
  child.stdout.on('data', (d) => process.env.SCREENSHOT_VERBOSE && process.stdout.write(d));
  return child;
}

async function waitForServer() {
  for (let i = 0; i < 100; i++) {
    try {
      const res = await fetch(`${BASE}/api/meta`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

async function apiLogin() {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ada@northlight.studio', password: 'password123' }),
  });
  if (!res.ok) throw new Error(`login failed: ${res.status}`);
  const cookie = res.headers.get('set-cookie');
  return cookie.split(';')[0];
}

async function apiGet(path, cookie) {
  const res = await fetch(`${BASE}${path}`, { headers: { cookie } });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function main() {
  if (
    !existsSync(join(ROOT, 'apps/api/dist/server.js')) ||
    !existsSync(join(ROOT, 'apps/web/dist/index.html'))
  ) {
    console.error('Build first: npm run build');
    process.exit(1);
  }
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });

  const server = startServer();
  try {
    await waitForServer();
    const cookie = await apiLogin();
    const [clients, projects, invoices, expenses, accounts, journal] = await Promise.all([
      apiGet(`/api/w/${SLUG}/clients?pageSize=5`, cookie),
      apiGet(`/api/w/${SLUG}/projects?pageSize=5`, cookie),
      apiGet(`/api/w/${SLUG}/invoices?status=sent&pageSize=5`, cookie),
      apiGet(`/api/w/${SLUG}/expenses?pageSize=5`, cookie),
      apiGet(`/api/w/${SLUG}/accounts`, cookie),
      apiGet(`/api/w/${SLUG}/journal?pageSize=5`, cookie),
    ]);
    const ids = {
      __CLIENT__: clients.items[0].id,
      __PROJECT__: projects.items[0].id,
      __INVOICE__: invoices.items[0].id,
      __EXPENSE__: expenses.items[0].id,
      __ACCOUNT__: accounts.items.find((a) => a.code === '1200').id,
      __JOURNAL__: journal.items[0].id,
    };

    const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
    const browser = await chromium.launch(executablePath ? { executablePath } : {});
    const [name, value] = cookie.split('=');
    const context = await browser.newContext({
      viewport: DESKTOP,
      deviceScaleFactor: 1,
      colorScheme: 'light',
    });
    await context.addCookies([{ name, value, domain: '127.0.0.1', path: '/' }]);
    const page = await context.newPage();

    for (const shot of SHOTS) {
      const path = Object.entries(ids).reduce((p, [k, v]) => p.replace(k, v), shot.path);
      await page.setViewportSize(shot.viewport ?? DESKTOP);
      await page.addInitScript((dark) => {
        try {
          localStorage.setItem('ll-theme', dark ? 'dark' : 'light');
        } catch {
          /* ignore */
        }
      }, Boolean(shot.dark));
      if (shot.before) await shot.before(page);
      else await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(400);
      const file = join(OUT, `${shot.name}.png`);
      await page.screenshot({ path: file, fullPage: Boolean(shot.full) });
      console.log(`✓ ${shot.name}`);
      // Log back in if a shot cleared the session.
      if (shot.name.startsWith('00-')) {
        await context.addCookies([{ name, value, domain: '127.0.0.1', path: '/' }]);
      }
    }

    await browser.close();
  } finally {
    server.kill('SIGTERM');
    rmSync(DB, { force: true });
    rmSync(`${DB}-wal`, { force: true });
    rmSync(`${DB}-shm`, { force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
