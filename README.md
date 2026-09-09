# Ledgerline

Ledgerline is a multi-workspace bookkeeping, invoicing and time-billing application for small
studios and consultancies. Each workspace has its own clients, projects, time log, invoices with an
approval workflow, expenses, a double-entry ledger with a chart of accounts and journal, and
financial reports (profit & loss, balance sheet, trial balance, receivables aging, tax summary,
revenue by client, time utilisation), plus a calendar, an approvals queue, notifications and
settings for members, tax rates and invoice numbering.

It runs entirely offline: one container, a SQLite file, no external services or API keys.

## Quick start (Docker)

```bash
git clone https://github.com/nirajvovra4/ledgerline.git
cd ledgerline
docker compose up --build
```

Open http://localhost:4000. The first boot seeds the **Northlight Studio** demo automatically
(`SEED_IF_EMPTY=true` in `docker-compose.yml`) and pins the application clock to
**30 June 2026** (`LEDGERLINE_TODAY`) so every screen is deterministic. Build plus first start
takes about two minutes on a laptop; subsequent starts take a few seconds.

To reset and reseed at any time:

```bash
docker compose run --rm app node --disable-warning=ExperimentalWarning apps/api/dist/cli.js seed
```

### Demo credentials

| Email                    | Password    | Role in Northlight Studio | Role in Harbour & Co |
| ------------------------ | ----------- | ------------------------- | -------------------- |
| ada@northlight.studio    | password123 | owner                     | admin                |
| marcus@northlight.studio | password123 | accountant                | owner                |
| priya@northlight.studio  | password123 | member                    | —                    |

## Local development (without Docker)

Requires Node 22.13 or newer (the API uses the built-in `node:sqlite` module).

```bash
npm install
npm run seed          # creates ./data/ledgerline.sqlite with the demo data
npm run dev           # API on :4000, Vite dev server on :5173 (proxies /api)
```

Set `LEDGERLINE_TODAY=2026-06-30` in your shell (or copy `.env.example` to `.env`) to see the
demo with the same "today" as the screenshots.

## Tests, type checking and linting

```bash
npm test              # all Vitest projects: shared, api, web
npm run typecheck     # tsc --noEmit for every workspace
npm run lint          # eslint
npm run format:check  # prettier
```

- `packages/shared` — unit tests for money arithmetic, dates, invoice totals, state machines,
  double-entry postings, report builders, aging and every Zod schema.
- `apps/api` — integration tests that boot the Fastify app against an in-memory SQLite database
  and exercise every endpoint through `app.inject()`: auth, permissions, the full invoice
  lifecycle (totals → approval → journal posting → payments → void/reversal), expenses,
  ledger, reports, approvals, notifications, dashboard, calendar, search and the seed.
- `apps/web` — component and hook tests (forms and validation, money/duration inputs, data
  table, invoice editor totals, manual journal balancing, API client, calendar, CSV export) plus
  page tests with a mocked API.

## Project layout

```
packages/shared   domain types, Zod schemas, money/date utilities, invoice & expense state
                  machines, double-entry posting rules, report builders (no runtime deps)
apps/api          Fastify 5 + Kysely over node:sqlite; migrations, services, routes, seed, CLI
apps/web          React 19 + Vite + React Router 7 + TanStack Query; hand-written CSS
docs/DESIGN.md    the contract both sides implement (entities, endpoints, roles, posting rules)
docs/screenshots  PNG captures of every page and state (npm run screenshots)
scripts/          count-loc.mjs (line count), screenshots.mjs (Playwright capture)
```

### Architecture notes

- **One source of truth for numbers.** `computeInvoiceTotals`, tax and discount allocation,
  aging buckets and report builders live in `@ledgerline/shared` and are called by both the API
  (persisted values) and the web app (live previews), so a document can never disagree with itself.
- **Real double-entry bookkeeping.** Approving an invoice posts AR / revenue / sales tax;
  payments post cash / AR; expenses post expense / input tax / AP and AP / cash when paid;
  voids and deletions post reversals. Manual entries must balance. The balance sheet and trial
  balance are computed from journal lines, not from stored totals.
- **Deterministic by design.** The server exposes `GET /api/meta` with its notion of "today";
  the web never uses the browser clock for business logic. The seed uses a seeded PRNG so IDs
  and data are identical on every machine. Money formatting avoids `Intl` so output is
  identical across runtimes.
- **Roles.** owner / admin / accountant / member with a permission matrix in
  `packages/shared/src/permissions.ts`, enforced by the API and reflected in the UI.

## Environment variables

| Variable          | Default                   | Purpose                                            |
| ----------------- | ------------------------- | -------------------------------------------------- |
| `PORT`            | `4000`                    | API / web port                                     |
| `DATABASE_PATH`   | `./data/ledgerline.sqlite`| SQLite file (`:memory:` for tests)                 |
| `LEDGERLINE_TODAY`| unset (real clock)        | Pin "today" to a `YYYY-MM-DD` date                 |
| `SEED_IF_EMPTY`   | `false`                   | Seed the demo on startup when there are no users   |
| `STATIC_DIR`      | `apps/web/dist` if present| Built web app to serve with an SPA fallback        |

## Screenshots

`docs/screenshots/` contains PNG captures of every page and state produced by
`npm run screenshots` (which builds nothing itself: run `npm run build` first, then the script
boots the production server on a throw-away seeded database, logs in and walks every route at
desktop and mobile widths in light and dark themes).

## Third-party services

None. There are no external SDKs, API keys or network calls; all data lives in the SQLite file.

## AI usage disclosure

This codebase was produced with Claude Code (Anthropic) from a written specification and design
direction supplied by the repository owner; the domain model, feature set, workflow rules and
visual identity were decided by the owner and the implementation was generated and iterated with
the AI tool. Commit history reflects when the work was actually done.

## License

MIT
