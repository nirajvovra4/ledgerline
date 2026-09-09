import {
  buildAccountTree,
  naturalBalance,
  SYSTEM_ACCOUNTS,
  type AccountDto,
  type AccountInput,
  type AccountNode,
  type AccountRegisterDto,
  type RegisterRow,
} from '@ledgerline/shared';
import { conflict, fieldError, notFound } from '../errors';
import { newId } from '../lib/ids';
import { resolvePage, sliceForPage, type PageInput } from '../lib/pagination';
import { toDbBool } from '../db/schema';
import { mapAccount } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type Ctx, type WorkspaceCtx } from './context';

export interface AccountTotals {
  debitCents: number;
  creditCents: number;
}

/** Sum of debits and credits per account for a workspace, optionally limited to a date range. */
export async function accountTotals(
  ctx: Ctx,
  workspaceId: string,
  range: { from?: string | null; to?: string | null } = {},
): Promise<Map<string, AccountTotals>> {
  let query = ctx.db
    .selectFrom('journal_lines as l')
    .innerJoin('journal_entries as e', 'e.id', 'l.entry_id')
    .select((eb) => [
      'l.account_id',
      eb.fn.sum<number>('l.debit_cents').as('debit'),
      eb.fn.sum<number>('l.credit_cents').as('credit'),
    ])
    .where('e.workspace_id', '=', workspaceId)
    .groupBy('l.account_id');
  if (range.from) query = query.where('e.date', '>=', range.from);
  if (range.to) query = query.where('e.date', '<=', range.to);
  const rows = await query.execute();
  return new Map(
    rows.map((r) => [
      r.account_id,
      { debitCents: Number(r.debit ?? 0), creditCents: Number(r.credit ?? 0) },
    ]),
  );
}

/** Insert the standard chart of accounts for a new workspace. */
export async function createSystemAccounts(ctx: Ctx, workspaceId: string): Promise<void> {
  const now = ctx.clock.now();
  await ctx.db
    .insertInto('accounts')
    .values(
      SYSTEM_ACCOUNTS.map((def) => ({
        id: newId(),
        workspace_id: workspaceId,
        code: def.code,
        name: def.name,
        type: def.type,
        parent_id: null,
        is_system: 1 as const,
        system_key: def.key,
        archived: 0 as const,
        description: def.description,
        created_at: now,
      })),
    )
    .execute();
}

export async function listAccounts(
  ctx: WorkspaceCtx,
  includeArchived = false,
): Promise<{ items: AccountDto[]; tree: AccountNode[] }> {
  let query = ctx.db
    .selectFrom('accounts')
    .selectAll()
    .where('workspace_id', '=', ctx.workspace.id)
    .orderBy('code');
  if (!includeArchived) query = query.where('archived', '=', 0);
  const [rows, totals] = await Promise.all([query.execute(), accountTotals(ctx, ctx.workspace.id)]);
  const items = rows.map((row) => {
    const t = totals.get(row.id) ?? { debitCents: 0, creditCents: 0 };
    return mapAccount(row, naturalBalance(row.type, t.debitCents, t.creditCents));
  });
  return { items, tree: buildAccountTree(items) };
}

export async function getAccount(ctx: WorkspaceCtx, id: string): Promise<AccountDto> {
  const row = await ctx.db
    .selectFrom('accounts')
    .selectAll()
    .where('id', '=', id)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!row) throw notFound('Account');
  const t = (await accountTotals(ctx, ctx.workspace.id)).get(id) ?? {
    debitCents: 0,
    creditCents: 0,
  };
  return mapAccount(row, naturalBalance(row.type, t.debitCents, t.creditCents));
}

async function assertCodeFree(ctx: WorkspaceCtx, code: string, excludeId?: string): Promise<void> {
  let q = ctx.db
    .selectFrom('accounts')
    .select('id')
    .where('workspace_id', '=', ctx.workspace.id)
    .where('code', '=', code);
  if (excludeId) q = q.where('id', '!=', excludeId);
  if (await q.executeTakeFirst())
    throw conflict(`Account code ${code} is already in use`, [
      { path: 'code', message: 'Code already in use' },
    ]);
}

async function assertParent(
  ctx: WorkspaceCtx,
  parentId: string | null,
  type: string,
  selfId?: string,
): Promise<void> {
  if (!parentId) return;
  if (parentId === selfId) throw fieldError('parentId', 'An account cannot be its own parent');
  const parent = await ctx.db
    .selectFrom('accounts')
    .select(['id', 'type'])
    .where('id', '=', parentId)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!parent) throw fieldError('parentId', 'Parent account not found');
  if (parent.type !== type) throw fieldError('parentId', 'Parent account must be of the same type');
}

export async function createAccount(ctx: WorkspaceCtx, input: AccountInput): Promise<AccountDto> {
  return withTransaction(ctx, async (tx) => {
    await assertCodeFree(tx, input.code);
    await assertParent(tx, input.parentId, input.type);
    const id = newId();
    await tx.db
      .insertInto('accounts')
      .values({
        id,
        workspace_id: tx.workspace.id,
        code: input.code,
        name: input.name,
        type: input.type,
        parent_id: input.parentId,
        is_system: 0,
        system_key: null,
        archived: toDbBool(input.archived),
        description: input.description,
        created_at: tx.clock.now(),
      })
      .execute();
    await logActivity(tx, {
      entityType: 'account',
      entityId: id,
      action: 'created',
      summary: `${tx.user.name} added account ${input.code} ${input.name}`,
      meta: { code: input.code },
    });
    return getAccount(tx, id);
  });
}

export async function updateAccount(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<AccountInput>,
): Promise<AccountDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('accounts')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Account');
    if (existing.is_system) {
      if (input.code !== undefined && input.code !== existing.code)
        throw fieldError('code', 'System accounts keep their code');
      if (input.type !== undefined && input.type !== existing.type)
        throw fieldError('type', 'System accounts keep their type');
      if (input.archived) throw fieldError('archived', 'System accounts cannot be archived');
    }
    const code = input.code ?? existing.code;
    const type = input.type ?? existing.type;
    if (code !== existing.code) await assertCodeFree(tx, code, id);
    const parentId = input.parentId === undefined ? existing.parent_id : input.parentId;
    await assertParent(tx, parentId, type, id);
    await tx.db
      .updateTable('accounts')
      .set({
        code,
        name: input.name ?? existing.name,
        type,
        parent_id: parentId,
        description: input.description ?? existing.description,
        archived: input.archived === undefined ? existing.archived : toDbBool(input.archived),
      })
      .where('id', '=', id)
      .execute();
    await logActivity(tx, {
      entityType: 'account',
      entityId: id,
      action: 'updated',
      summary: `${tx.user.name} updated account ${code} ${input.name ?? existing.name}`,
      meta: { code },
    });
    return getAccount(tx, id);
  });
}

export interface RegisterQuery extends PageInput {
  from?: string;
  to?: string;
}

/** Account register: every posting to one account with a running balance in natural direction. */
export async function accountRegister(
  ctx: WorkspaceCtx,
  id: string,
  query: RegisterQuery,
): Promise<AccountRegisterDto> {
  const account = await getAccount(ctx, id);
  const rows = await ctx.db
    .selectFrom('journal_lines as l')
    .innerJoin('journal_entries as e', 'e.id', 'l.entry_id')
    .select([
      'e.id as entry_id',
      'e.entry_number',
      'e.date',
      'e.memo',
      'e.source_type',
      'l.debit_cents',
      'l.credit_cents',
    ])
    .where('l.account_id', '=', id)
    .where('e.workspace_id', '=', ctx.workspace.id)
    .orderBy('e.date')
    .orderBy('e.entry_number')
    .orderBy('l.position')
    .execute();

  let running = 0;
  const items: RegisterRow[] = [];
  for (const r of rows) {
    const delta = naturalBalance(account.type, r.debit_cents, r.credit_cents);
    if (query.from && r.date < query.from) {
      running += delta;
      continue;
    }
    if (query.to && r.date > query.to) continue;
    running += delta;
    items.push({
      entryId: r.entry_id,
      entryNumber: r.entry_number,
      date: r.date,
      memo: r.memo,
      sourceType: r.source_type,
      debitCents: r.debit_cents,
      creditCents: r.credit_cents,
      runningBalanceCents: running,
    });
  }
  const openingBalanceCents =
    items.length > 0
      ? (items[0]?.runningBalanceCents ?? 0) -
        naturalBalance(account.type, items[0]?.debitCents ?? 0, items[0]?.creditCents ?? 0)
      : running;
  const page = resolvePage(query);
  return {
    account,
    from: query.from ?? null,
    to: query.to ?? null,
    openingBalanceCents,
    closingBalanceCents: running,
    items: sliceForPage(items, page),
    total: items.length,
    page: page.page,
    pageSize: page.pageSize,
  };
}
