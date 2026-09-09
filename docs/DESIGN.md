# Ledgerline — design contract

Ledgerline is a multi-workspace bookkeeping, invoicing and time-billing application for small
studios and consultancies. One person can belong to several workspaces (studios); each workspace
owns its own clients, projects, time entries, invoices, expenses, chart of accounts and journal.

This document is the contract shared by `packages/shared`, `apps/api` and `apps/web`. Anything that
crosses a package boundary (types, enums, validation schemas, endpoint shapes, calculation rules)
is defined here and implemented in `@ledgerline/shared` so both sides use one source of truth.

---

## 1. Stack

| Layer     | Choice                                                                          |
| --------- | ------------------------------------------------------------------------------- |
| Shared    | TypeScript, Zod schemas, pure calculation utilities                             |
| API       | Node 22, Fastify 5, Kysely query builder over `node:sqlite` (custom driver)     |
| Web       | React 19, Vite, React Router 7, TanStack Query 5, hand-written CSS (no UI kit)  |
| Database  | SQLite file (`data/ledgerline.sqlite`), migrations run automatically at startup |
| Tests     | Vitest everywhere; API tests use an in-memory SQLite + `app.inject()`           |
| Container | Single image; API serves the built web bundle; volume for the SQLite file       |

Conventions:

- Money is always an **integer number of cents** (`amountCents`). Never floats.
- Tax rates are **basis points** (`rateBp`, 2000 = 20%). Discounts are basis points too.
- Business dates are ISO `YYYY-MM-DD` strings (`IsoDate`). Timestamps are ISO 8601 UTC strings.
- IDs are UUID strings. Seeded data uses deterministic UUIDs so screens are reproducible.
- "Today" comes from the server (`GET /api/meta`), which honours `LEDGERLINE_TODAY` for
  deterministic demos. The web never uses the browser clock for business logic.
- All API responses are JSON. Errors: `{ "error": { "code": string, "message": string, "details"?: unknown } }`.
- List endpoints return `{ items: T[], total: number, page: number, pageSize: number }`.
- Auth is a session cookie `ll_session` (httpOnly, sameSite=lax). No JWT, no external services.

---

## 2. Domain model

### Users & workspaces

| Entity      | Fields                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| User        | id, email, name, passwordHash, createdAt                                                                      |
| Session     | id (token), userId, expiresAt, createdAt                                                                      |
| Workspace   | id, name, slug, currency (ISO 4217), settings (JSON, see WorkspaceSettings), createdAt                        |
| Membership  | workspaceId, userId, role (`owner` \| `admin` \| `accountant` \| `member`), createdAt                          |
| Invite      | id, workspaceId, email, role, token, invitedBy, acceptedAt?, createdAt                                        |

`WorkspaceSettings`:

```ts
{
  invoicePrefix: string;          // "INV"
  nextInvoiceNumber: number;      // 1042
  invoiceNumberPadding: number;   // 4  -> INV-1042
  defaultPaymentTermsDays: number;// 30
  defaultTaxRateId: string | null;
  requireInvoiceApproval: boolean;
  requireExpenseApproval: boolean;
  fiscalYearStartMonth: number;   // 1..12
  invoiceFooter: string;
  address: string;
  email: string;
  phone: string;
}
```

### Clients, projects, time

| Entity     | Fields                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Client     | id, workspaceId, name, company, email, phone, addressLine1, addressLine2, city, region, postalCode, country, taxId, paymentTermsDays, notes, status (`active` \| `archived`), createdAt, updatedAt |
| Project    | id, workspaceId, clientId, name, code, description, status (`active` \| `on_hold` \| `completed` \| `archived`), billingType (`hourly` \| `fixed`), hourlyRateCents, budgetCents, startDate?, endDate?, createdAt, updatedAt |
| TimeEntry  | id, workspaceId, projectId, userId, date, minutes, description, billable, invoiceLineId?, createdAt, updatedAt                              |

### Invoicing

| Entity      | Fields                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| TaxRate     | id, workspaceId, name, rateBp, isDefault, archived                                                                                                           |
| Invoice     | id, workspaceId, clientId, projectId?, number, status, issueDate, dueDate, currency, discountBp, subtotalCents, discountCents, taxCents, totalCents, amountPaidCents, notes, terms, poNumber, sentAt?, approvedAt?, approvedBy?, voidedAt?, voidReason?, createdBy, createdAt, updatedAt |
| InvoiceLine | id, invoiceId, position, description, quantity (number, up to 2 decimals), unitPriceCents, taxRateId?, accountId (revenue account), lineTotalCents, taxCents |
| Payment     | id, workspaceId, invoiceId, date, amountCents, method (`bank_transfer` \| `card` \| `cash` \| `cheque` \| `other`), reference, note, journalEntryId?, createdBy, createdAt |

Invoice status: `draft` → `pending_approval` → `approved` → `sent` → `partially_paid` → `paid`.
`void` is reachable from any status except `paid`. `rejected` returns to `draft` with a comment.
`overdue` is **derived** (status in sent/partially_paid and dueDate < today), never stored.

### Expenses

| Entity  | Fields                                                                                                                                                        |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Expense | id, workspaceId, vendor, description, date, dueDate?, accountId (expense account), amountCents (net), taxRateId?, taxCents, totalCents, status (`draft` \| `pending_approval` \| `approved` \| `paid` \| `rejected`), clientId?, projectId?, billable, paidAt?, paymentMethod?, reference, notes, createdBy, createdAt, updatedAt |

### Ledger

| Entity       | Fields                                                                                                                              |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Account      | id, workspaceId, code (string, "1200"), name, type (`asset` \| `liability` \| `equity` \| `revenue` \| `expense`), parentId?, isSystem, systemKey?, archived, description |
| JournalEntry | id, workspaceId, entryNumber, date, memo, sourceType (`invoice` \| `payment` \| `expense` \| `expense_payment` \| `manual` \| `reversal`), sourceId?, reversedEntryId?, postedBy, createdAt |
| JournalLine  | id, entryId, accountId, debitCents, creditCents, description                                                                         |

System accounts (created for every workspace; `systemKey` values):

| systemKey           | code | name                     | type      |
| ------------------- | ---- | ------------------------ | --------- |
| cash                | 1000 | Operating Bank Account   | asset     |
| accounts_receivable | 1200 | Accounts Receivable      | asset     |
| input_tax           | 1300 | Input Tax Receivable     | asset     |
| accounts_payable    | 2000 | Accounts Payable         | liability |
| sales_tax_payable   | 2200 | Sales Tax Payable        | liability |
| owner_equity        | 3000 | Owner's Equity           | equity    |
| retained_earnings   | 3900 | Retained Earnings        | equity    |
| services_revenue    | 4000 | Services Revenue         | revenue   |
| product_revenue     | 4100 | Product Revenue          | revenue   |
| other_income        | 4900 | Other Income             | revenue   |
| software_expense    | 5100 | Software & Subscriptions | expense   |
| travel_expense      | 5200 | Travel                   | expense   |
| contractor_expense  | 5300 | Contractors              | expense   |
| office_expense      | 5400 | Office & Equipment       | expense   |
| marketing_expense   | 5500 | Marketing                | expense   |
| other_expense       | 5900 | Other Expenses           | expense   |

Posting rules (implemented in `shared/ledger/postings.ts`, applied by the API):

| Event                  | Debit                                           | Credit                                            |
| ---------------------- | ----------------------------------------------- | ------------------------------------------------- |
| Invoice approved       | AR: total                                       | each line's revenue account: lineTotal − discount share; Sales Tax Payable: tax |
| Payment recorded       | Cash: amount                                    | AR: amount                                        |
| Invoice voided         | reversal of the approval entry (and payment entries stay; voiding a paid invoice is forbidden) |
| Expense approved       | expense account: net; Input Tax: tax            | AP: total                                         |
| Expense paid           | AP: total                                       | Cash: total                                       |
| Manual entry           | as entered; must balance                        |                                                   |

### Workflow, notifications, activity

| Entity       | Fields                                                                                                                                         |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Approval     | id, workspaceId, subjectType (`invoice` \| `expense`), subjectId, requestedBy, status (`pending` \| `approved` \| `rejected`), decidedBy?, comment, createdAt, decidedAt? |
| Notification | id, workspaceId, userId, kind, title, body, link, readAt?, createdAt                                                                            |
| Activity     | id, workspaceId, actorId, entityType, entityId, action, summary, meta (JSON), createdAt                                                        |

Notification kinds: `approval_requested`, `approval_decided`, `invoice_sent`, `payment_received`,
`invoice_overdue`, `member_joined`, `mention`, `system`.

### Roles

| Action                              | owner | admin | accountant | member |
| ----------------------------------- | ----- | ----- | ---------- | ------ |
| workspace.manage (settings, delete) | ✓     | ✓     |            |        |
| members.manage                      | ✓     | ✓     |            |        |
| clients.manage                      | ✓     | ✓     | ✓          |        |
| clients.view                        | ✓     | ✓     | ✓          | ✓      |
| projects.manage                     | ✓     | ✓     | ✓          |        |
| time.manage_own                     | ✓     | ✓     | ✓          | ✓      |
| time.manage_all                     | ✓     | ✓     | ✓          |        |
| invoices.create                     | ✓     | ✓     | ✓          | ✓      |
| invoices.approve                    | ✓     | ✓     | ✓          |        |
| invoices.send                       | ✓     | ✓     | ✓          |        |
| invoices.void                       | ✓     | ✓     | ✓          |        |
| payments.manage                     | ✓     | ✓     | ✓          |        |
| expenses.create                     | ✓     | ✓     | ✓          | ✓      |
| expenses.approve                    | ✓     | ✓     | ✓          |        |
| ledger.view                         | ✓     | ✓     | ✓          |        |
| ledger.post                         | ✓     | ✓     | ✓          |        |
| reports.view                        | ✓     | ✓     | ✓          |        |

`shared/permissions.ts` exports `can(role, action)` and `ROLE_PERMISSIONS`.

---

## 3. Shared package (`@ledgerline/shared`)

Exports (all from `src/index.ts`):

- `types.ts` — every entity type above plus DTOs: `UserDto`, `WorkspaceSummary`, `WorkspaceDto`,
  `MemberDto`, `ClientDto`, `ClientStats`, `ProjectDto`, `ProjectStats`, `TimeEntryDto`,
  `InvoiceDto`, `InvoiceDetailDto`, `InvoiceLineDto`, `PaymentDto`, `ExpenseDto`, `AccountDto`,
  `AccountNode`, `JournalEntryDto`, `JournalLineDto`, `ApprovalDto`, `NotificationDto`,
  `ActivityDto`, `DashboardDto`, report DTOs, `Paginated<T>`, `ApiError`.
- `schemas.ts` — Zod schemas for every request body / query: `registerSchema`, `loginSchema`,
  `createWorkspaceSchema`, `updateWorkspaceSettingsSchema`, `inviteMemberSchema`, `clientInputSchema`,
  `projectInputSchema`, `timeEntryInputSchema`, `taxRateInputSchema`, `invoiceInputSchema`,
  `invoiceLineInputSchema`, `recordPaymentSchema`, `expenseInputSchema`, `accountInputSchema`,
  `manualJournalEntrySchema`, `listQuerySchema`, `dateRangeSchema`, etc. Each has an inferred
  `XInput` type.
- `money.ts` — `addCents`, `mulCents(cents, qty)`, `applyBp(cents, bp)`, `roundHalfEven`,
  `allocateProportionally(total, weights)`, `formatMoney(cents, currency, locale?)`,
  `parseMoneyInput(str) -> cents | null`, `centsToDecimalString`.
- `tax.ts` — `taxForLine`, `summariseTaxByRate`.
- `invoice/totals.ts` — `computeInvoiceTotals(lines, discountBp)` returning per-line and totals.
- `invoice/status.ts` — `INVOICE_TRANSITIONS`, `canTransition(from, to)`, `deriveInvoiceStatus(invoice, today)`,
  `invoiceActions(invoice, role, settings)`.
- `invoice/numbering.ts` — `formatInvoiceNumber(prefix, n, padding)`, `parseInvoiceNumber`.
- `expense/status.ts` — expense transitions and `expenseActions`.
- `ledger/postings.ts` — `postingsForInvoice`, `postingsForPayment`, `postingsForExpense`,
  `postingsForExpensePayment`, `reversePostings`, `assertBalanced`.
- `ledger/reports.ts` — `buildProfitAndLoss(lines, accounts, range)`, `buildBalanceSheet`,
  `buildTrialBalance`, `accountBalance`.
- `aging.ts` — `AGING_BUCKETS`, `agingBucketFor(dueDate, asOf)`, `buildAgingReport(invoices, asOf)`.
- `dates.ts` — `IsoDate` helpers: `parseIsoDate`, `toIsoDate`, `addDays`, `addMonths`, `diffDays`,
  `startOfMonth`, `endOfMonth`, `monthRange`, `fiscalYearRange`, `formatDate`, `formatRelative`,
  `isBefore`, `isWeekend`, `weekOf`, `calendarGrid(year, month)`.
- `time.ts` — `minutesToDuration`, `parseDuration("1h 30m" | "1.5" | "90m")`, `groupTimeByDay`,
  `billableAmount(minutes, rateCents)`.
- `text.ts` — `slugify`, `initials`, `pluralize`, `truncate`, `titleCase`, `compareStrings`.
- `ids.ts` — `SeededRandom`, `seededUuid(rng)`.
- `permissions.ts` — as above.
- `constants.ts` — currencies, payment methods, statuses with labels & tones, notification kinds.
- `validation.ts` — `validate(schema, data) -> { ok, data | issues }` and `formatIssues`.

Design rule: nothing in `shared` imports Node or DOM APIs.

---

## 4. API (`apps/api`)

Base URL `/api`. All workspace-scoped routes live under `/api/w/:slug/...` and require
membership. Route handlers validate bodies/queries with the shared Zod schemas and reply with the
shared DTOs. Services (`src/services/*.ts`) hold business logic; routes stay thin.

### Meta & auth

| Method | Path                    | Body / query              | Response                                     |
| ------ | ----------------------- | ------------------------- | -------------------------------------------- |
| GET    | /api/meta               |                           | `{ today: IsoDate, version: string, fixedClock: boolean }` |
| POST   | /api/auth/register      | registerSchema            | `{ user: UserDto }`                          |
| POST   | /api/auth/login         | loginSchema               | `{ user: UserDto }`                          |
| POST   | /api/auth/logout        |                           | `{ ok: true }`                               |
| GET    | /api/auth/me            |                           | `{ user: UserDto, workspaces: WorkspaceSummary[] }` |
| PATCH  | /api/auth/me            | updateProfileSchema       | `{ user: UserDto }`                          |
| POST   | /api/auth/password      | changePasswordSchema      | `{ ok: true }`                               |
| POST   | /api/invites/:token/accept |                        | `{ workspace: WorkspaceSummary }`            |

### Workspaces

| Method | Path                                | Body / query                  | Response                         |
| ------ | ----------------------------------- | ----------------------------- | -------------------------------- |
| GET    | /api/workspaces                     |                               | `{ items: WorkspaceSummary[] }`  |
| POST   | /api/workspaces                     | createWorkspaceSchema         | `{ workspace: WorkspaceDto }`    |
| GET    | /api/w/:slug                        |                               | `{ workspace: WorkspaceDto, role }` |
| PATCH  | /api/w/:slug                        | updateWorkspaceSchema         | `{ workspace: WorkspaceDto }`    |
| GET    | /api/w/:slug/members                |                               | `{ items: MemberDto[], invites: InviteDto[] }` |
| POST   | /api/w/:slug/members/invite         | inviteMemberSchema            | `{ invite: InviteDto }`          |
| PATCH  | /api/w/:slug/members/:userId        | `{ role }`                    | `{ member: MemberDto }`          |
| DELETE | /api/w/:slug/members/:userId        |                               | `{ ok: true }`                   |
| DELETE | /api/w/:slug/invites/:inviteId      |                               | `{ ok: true }`                   |
| GET    | /api/w/:slug/dashboard              | `?range=month|quarter|year`   | `DashboardDto`                   |
| GET    | /api/w/:slug/activity               | `?limit&before`               | `{ items: ActivityDto[] }`       |
| GET    | /api/w/:slug/search                 | `?q`                          | `{ clients, projects, invoices, expenses }` (each an array of `SearchHit`) |
| GET    | /api/w/:slug/calendar               | `?month=YYYY-MM`              | `{ events: CalendarEvent[] }`    |

### Clients / projects / time

| Method | Path                                   | Body / query                                               | Response                          |
| ------ | -------------------------------------- | ---------------------------------------------------------- | --------------------------------- |
| GET    | /api/w/:slug/clients                   | `?q&status&sort&dir&page&pageSize`                          | `Paginated<ClientDto>`            |
| POST   | /api/w/:slug/clients                   | clientInputSchema                                          | `{ client: ClientDto }`           |
| GET    | /api/w/:slug/clients/:id               |                                                            | `{ client: ClientDto, stats: ClientStats, projects: ProjectDto[], invoices: InvoiceDto[] }` |
| PATCH  | /api/w/:slug/clients/:id               | clientInputSchema.partial()                                | `{ client }`                      |
| DELETE | /api/w/:slug/clients/:id               |                                                            | archives → `{ client }`           |
| GET    | /api/w/:slug/clients/:id/statement     | `?from&to`                                                 | `ClientStatementDto`              |
| GET    | /api/w/:slug/projects                  | `?q&status&clientId&sort&dir&page&pageSize`                 | `Paginated<ProjectDto>`           |
| POST   | /api/w/:slug/projects                  | projectInputSchema                                         | `{ project }`                     |
| GET    | /api/w/:slug/projects/:id              |                                                            | `{ project, stats: ProjectStats, recentEntries: TimeEntryDto[] }` |
| PATCH  | /api/w/:slug/projects/:id              | projectInputSchema.partial()                               | `{ project }`                     |
| DELETE | /api/w/:slug/projects/:id              |                                                            | archives → `{ project }`          |
| GET    | /api/w/:slug/time-entries              | `?projectId&userId&from&to&billable&uninvoiced&page&pageSize` | `Paginated<TimeEntryDto>`      |
| POST   | /api/w/:slug/time-entries              | timeEntryInputSchema                                       | `{ entry }`                       |
| PATCH  | /api/w/:slug/time-entries/:id          | partial                                                    | `{ entry }`                       |
| DELETE | /api/w/:slug/time-entries/:id          |                                                            | `{ ok }`                          |
| GET    | /api/w/:slug/time-entries/summary      | `?from&to`                                                 | `TimeSummaryDto` (per day, per project totals) |

### Invoicing

| Method | Path                                        | Body / query                                       | Response                       |
| ------ | ------------------------------------------- | -------------------------------------------------- | ------------------------------ |
| GET    | /api/w/:slug/tax-rates                      |                                                    | `{ items: TaxRateDto[] }`      |
| POST   | /api/w/:slug/tax-rates                      | taxRateInputSchema                                 | `{ taxRate }`                  |
| PATCH  | /api/w/:slug/tax-rates/:id                  | partial                                            | `{ taxRate }`                  |
| DELETE | /api/w/:slug/tax-rates/:id                  |                                                    | archives                       |
| GET    | /api/w/:slug/invoices                       | `?q&status&clientId&from&to&sort&dir&page&pageSize` (status may be `overdue`) | `Paginated<InvoiceDto>` + `summary: { count, totalCents, outstandingCents, overdueCents }` |
| POST   | /api/w/:slug/invoices                       | invoiceInputSchema                                 | `{ invoice: InvoiceDetailDto }`|
| POST   | /api/w/:slug/invoices/from-time             | `{ clientId, projectId, entryIds[], groupBy: 'entry'|'day'|'project' }` | `{ invoice }` |
| GET    | /api/w/:slug/invoices/:id                   |                                                    | `{ invoice: InvoiceDetailDto }`|
| PATCH  | /api/w/:slug/invoices/:id                   | invoiceInputSchema (draft only)                    | `{ invoice }`                  |
| DELETE | /api/w/:slug/invoices/:id                   | draft only                                         | `{ ok }`                       |
| POST   | /api/w/:slug/invoices/:id/submit            |                                                    | `{ invoice }`                  |
| POST   | /api/w/:slug/invoices/:id/approve           | `{ comment? }`                                     | `{ invoice }`                  |
| POST   | /api/w/:slug/invoices/:id/reject            | `{ comment }`                                      | `{ invoice }`                  |
| POST   | /api/w/:slug/invoices/:id/send              |                                                    | `{ invoice }`                  |
| POST   | /api/w/:slug/invoices/:id/void              | `{ reason }`                                       | `{ invoice }`                  |
| POST   | /api/w/:slug/invoices/:id/payments          | recordPaymentSchema                                | `{ invoice, payment }`         |
| GET    | /api/w/:slug/payments                       | `?clientId&from&to&method&page&pageSize`            | `Paginated<PaymentDto>`        |
| DELETE | /api/w/:slug/payments/:id                   | reverses the payment and its journal entry         | `{ ok }`                       |

`InvoiceDetailDto` = `InvoiceDto` + `lines: InvoiceLineDto[]`, `client: ClientDto`,
`project?: ProjectDto`, `payments: PaymentDto[]`, `approvals: ApprovalDto[]`,
`journalEntries: JournalEntryDto[]`, `history: ActivityDto[]`, `derivedStatus` (includes overdue),
`balanceCents`.

### Expenses

| Method | Path                                    | Body / query                                     |
| ------ | --------------------------------------- | ------------------------------------------------ |
| GET    | /api/w/:slug/expenses                   | `?q&status&accountId&clientId&from&to&sort&dir&page&pageSize` → `Paginated<ExpenseDto>` + summary |
| POST   | /api/w/:slug/expenses                   | expenseInputSchema                               |
| GET    | /api/w/:slug/expenses/:id               | `{ expense, approvals, journalEntries, history }`|
| PATCH  | /api/w/:slug/expenses/:id               | partial (draft/rejected only)                    |
| DELETE | /api/w/:slug/expenses/:id               | draft only                                       |
| POST   | /api/w/:slug/expenses/:id/submit        |                                                  |
| POST   | /api/w/:slug/expenses/:id/approve       | `{ comment? }`                                   |
| POST   | /api/w/:slug/expenses/:id/reject        | `{ comment }`                                    |
| POST   | /api/w/:slug/expenses/:id/pay           | `{ date, method, reference? }`                   |

### Ledger & reports

| Method | Path                                      | Body / query                                       |
| ------ | ----------------------------------------- | -------------------------------------------------- |
| GET    | /api/w/:slug/accounts                     | `?includeArchived` → `{ items: AccountDto[], tree: AccountNode[] }` (each with `balanceCents`) |
| POST   | /api/w/:slug/accounts                     | accountInputSchema                                 |
| PATCH  | /api/w/:slug/accounts/:id                 | partial                                            |
| GET    | /api/w/:slug/accounts/:id/register        | `?from&to&page&pageSize` → `{ account, openingBalanceCents, items: RegisterRow[], closingBalanceCents, total }` |
| GET    | /api/w/:slug/journal                      | `?from&to&accountId&sourceType&q&page&pageSize` → `Paginated<JournalEntryDto>` |
| POST   | /api/w/:slug/journal                      | manualJournalEntrySchema                           |
| GET    | /api/w/:slug/journal/:id                  | `{ entry: JournalEntryDto }`                       |
| POST   | /api/w/:slug/journal/:id/reverse          | `{ date?, memo? }`                                 |
| GET    | /api/w/:slug/reports/profit-loss          | `?from&to&compare=previous` → `ProfitLossDto`      |
| GET    | /api/w/:slug/reports/balance-sheet        | `?asOf` → `BalanceSheetDto`                        |
| GET    | /api/w/:slug/reports/trial-balance        | `?asOf` → `TrialBalanceDto`                        |
| GET    | /api/w/:slug/reports/ar-aging             | `?asOf` → `AgingReportDto`                         |
| GET    | /api/w/:slug/reports/tax-summary          | `?from&to` → `TaxSummaryDto`                       |
| GET    | /api/w/:slug/reports/revenue-by-client    | `?from&to` → `RevenueByClientDto`                  |
| GET    | /api/w/:slug/reports/time-utilisation     | `?from&to` → `TimeUtilisationDto`                  |

### Approvals & notifications

| Method | Path                                      |                                                     |
| ------ | ----------------------------------------- | --------------------------------------------------- |
| GET    | /api/w/:slug/approvals                    | `?status=pending|approved|rejected|all` → `{ items: ApprovalDto[] }` with subject summaries |
| GET    | /api/w/:slug/notifications                | `?unread&page&pageSize` → `Paginated<NotificationDto>` + `unreadCount` |
| POST   | /api/w/:slug/notifications/read-all       |                                                     |
| POST   | /api/w/:slug/notifications/:id/read       |                                                     |

### Error codes

`validation_error` (400), `unauthenticated` (401), `forbidden` (403), `not_found` (404),
`conflict` (409, e.g. duplicate email / slug / invoice number), `invalid_transition` (409),
`unbalanced_entry` (422), `internal_error` (500).

---

## 5. Web (`apps/web`)

Routes (React Router):

```
/login
/register
/invite/:token
/workspaces                       workspace switcher + create
/w/:slug                          → redirects to dashboard
/w/:slug/dashboard
/w/:slug/clients                  table: search, status filter, sort, pagination
/w/:slug/clients/new
/w/:slug/clients/:id              tabs: overview · projects · invoices · statement
/w/:slug/clients/:id/edit
/w/:slug/projects
/w/:slug/projects/new
/w/:slug/projects/:id             budget burn, time log, uninvoiced summary
/w/:slug/projects/:id/edit
/w/:slug/time                     week strip + entry list + quick-add
/w/:slug/invoices                 status tabs, filters, bulk summary
/w/:slug/invoices/new             3-step editor: client & dates → lines → review
/w/:slug/invoices/from-time       pick uninvoiced entries
/w/:slug/invoices/:id             document view, timeline, payments, actions
/w/:slug/invoices/:id/edit
/w/:slug/invoices/:id/print       printable document
/w/:slug/payments
/w/:slug/expenses
/w/:slug/expenses/new
/w/:slug/expenses/:id
/w/:slug/expenses/:id/edit
/w/:slug/ledger/accounts          chart of accounts tree
/w/:slug/ledger/accounts/:id      account register
/w/:slug/ledger/journal           journal list + manual entry drawer
/w/:slug/ledger/journal/:id
/w/:slug/reports                  index
/w/:slug/reports/profit-loss
/w/:slug/reports/balance-sheet
/w/:slug/reports/trial-balance
/w/:slug/reports/ar-aging
/w/:slug/reports/tax-summary
/w/:slug/reports/revenue-by-client
/w/:slug/reports/time-utilisation
/w/:slug/calendar                 month grid of due dates, payments, expenses
/w/:slug/approvals
/w/:slug/notifications
/w/:slug/settings                 tabs: general · invoicing · tax rates · members · profile
```

### Visual identity — "ruled paper"

The UI should look like a well-typeset accounting ledger, not a SaaS dashboard template:

- Palette: paper `#f6f2ea`, ink `#1c2430`, ledger-blue `#2b4c7e`, ledger-red `#a23b2e` (debits /
  overdue), moss `#4a6b3f` (paid / positive), amber `#b7791f` (pending), rule-grey `#d9d3c7`.
  Dark theme swaps paper for `#151a21` with the same accents.
- Type: a serif display face for page titles and document headers (system serif stack —
  `"Iowan Old Style", "Palatino Linotype", Georgia, serif`), a humanist sans for UI, and tabular
  numerals everywhere numbers appear (`font-variant-numeric: tabular-nums`).
- Layout: a narrow left rail with the workspace switcher, a top "ledger line" strip showing the
  page title, breadcrumbs and primary action; content on a subtly ruled background (1px horizontal
  rules every 32px, very low contrast).
- Tables have hairline row rules, right-aligned monetary columns with red-negative rendering,
  and sticky headers. Status appears as a small stamp-like chip (uppercase, letter-spaced,
  outlined) rather than a filled pill.
- Empty states use a short line of guidance plus an outlined action, never illustrations.
- Forms are two-column on wide screens with inline validation messages under fields; the
  invoice editor has a live totals panel that recalculates using `computeInvoiceTotals`.
- Every screen has loading, empty, error and populated states. Mobile: the rail collapses to a
  bottom bar; tables scroll horizontally inside their container.

Web architecture:

- `src/api/` — typed fetch client (`apiFetch`) + one module per resource with TanStack Query hooks.
- `src/components/` — design system: `Button`, `Input`, `Select`, `Textarea`, `MoneyInput`,
  `DateInput`, `Field`, `Table`, `DataTable` (sort/paginate), `StatusStamp`, `Stat`, `Tabs`,
  `Modal`, `Drawer`, `Toast`, `EmptyState`, `Skeleton`, `PageHeader`, `Breadcrumbs`,
  `Pagination`, `SearchBox`, `Avatar`, `Dropdown`, `ConfirmDialog`, `BarChart`, `Sparkline`,
  `Timeline`, `KeyValue`.
- `src/pages/` — one folder per area with `*Page.tsx` files.
- `src/hooks/` — `useWorkspace`, `useAuth`, `useToday`, `useDebounce`, `useQueryParams`,
  `usePermission`, `useHotkeys`.
- `src/lib/` — web-only formatters that wrap shared utilities with the workspace currency.

---

## 6. Seed data

`npm run seed` (or `docker compose run --rm app npm run seed`) resets the database and loads the
"Northlight Studio" demo: 3 users, 2 workspaces, 14 clients, 22 projects, ~400 time entries,
~60 invoices across every status, ~45 expenses, ~25 payments, a full chart of accounts with
journal entries, pending approvals and notifications. Dates are anchored to a fixed demo "today"
of **2026-06-30**; docker-compose sets `LEDGERLINE_TODAY=2026-06-30` so the demo is deterministic.

Demo credentials:

| Email                      | Password     | Role in Northlight Studio |
| -------------------------- | ------------ | ------------------------- |
| ada@northlight.studio      | password123  | owner                     |
| marcus@northlight.studio   | password123  | accountant                |
| priya@northlight.studio    | password123  | member                    |
