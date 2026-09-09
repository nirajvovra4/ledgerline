import {
  assertBalanced,
  reversePostings,
  UnbalancedEntryError,
  type JournalEntryDto,
  type JournalSourceType,
  type ManualJournalEntryInput,
  type Paginated,
  type PostingLine,
  type SystemAccountKey,
} from '@ledgerline/shared';
import { conflict, fieldError, notFound, unbalanced } from '../errors';
import { newId } from '../lib/ids';
import { likeContains, paginated, resolvePage, type PageInput } from '../lib/pagination';
import { mapJournalEntry, type JournalEntryRow, type JournalLineRow } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type Ctx, type WorkspaceCtx } from './context';

export interface PostEntryInput {
  date: string;
  memo: string;
  sourceType: JournalSourceType;
  sourceId?: string | null;
  reversedEntryId?: string | null;
  lines: PostingLine[];
}

/** Map every system-account key of a workspace to its account id. */
export async function systemAccountMap(
  ctx: Ctx,
  workspaceId: string,
): Promise<Map<SystemAccountKey, string>> {
  const rows = await ctx.db
    .selectFrom('accounts')
    .select(['id', 'system_key'])
    .where('workspace_id', '=', workspaceId)
    .where('system_key', 'is not', null)
    .execute();
  const map = new Map<SystemAccountKey, string>();
  for (const r of rows) if (r.system_key) map.set(r.system_key, r.id);
  return map;
}

export async function systemAccountId(
  ctx: Ctx,
  workspaceId: string,
  key: SystemAccountKey,
): Promise<string> {
  const id = (await systemAccountMap(ctx, workspaceId)).get(key);
  if (!id) throw new Error(`Workspace ${workspaceId} is missing system account "${key}"`);
  return id;
}

/**
 * Persist a balanced journal entry. Posting lines may reference accounts by id or by system key;
 * keys are resolved against the workspace's chart of accounts. Entry numbers are sequential per
 * workspace and allocated inside the transaction.
 */
export async function postEntry(
  ctx: WorkspaceCtx,
  input: PostEntryInput,
): Promise<JournalEntryDto> {
  return withTransaction(ctx, async (tx) => {
    let lines: PostingLine[];
    try {
      lines = assertBalanced(input.lines);
    } catch (err) {
      if (err instanceof UnbalancedEntryError) throw unbalanced(err.debitCents, err.creditCents);
      throw err;
    }
    if (lines.length === 0) throw fieldError('lines', 'A journal entry needs at least one line');

    const systemAccounts = await systemAccountMap(tx, tx.workspace.id);
    const resolved = lines.map((line) => {
      const accountId =
        'id' in line.account ? line.account.id : systemAccounts.get(line.account.systemKey);
      if (!accountId)
        throw new Error(`Cannot resolve account for posting line: ${JSON.stringify(line.account)}`);
      return { ...line, accountId };
    });

    const { max } = await tx.db
      .selectFrom('journal_entries')
      .select((eb) => eb.fn.max('entry_number').as('max'))
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirstOrThrow();
    const entryNumber = Number(max ?? 0) + 1;
    const id = newId();
    const now = tx.clock.now();

    await tx.db
      .insertInto('journal_entries')
      .values({
        id,
        workspace_id: tx.workspace.id,
        entry_number: entryNumber,
        date: input.date,
        memo: input.memo,
        source_type: input.sourceType,
        source_id: input.sourceId ?? null,
        reversed_entry_id: input.reversedEntryId ?? null,
        posted_by: tx.user.id,
        created_at: now,
      })
      .execute();
    await tx.db
      .insertInto('journal_lines')
      .values(
        resolved.map((line, i) => ({
          id: newId(),
          entry_id: id,
          position: i,
          account_id: line.accountId,
          debit_cents: line.debitCents,
          credit_cents: line.creditCents,
          description: line.description,
        })),
      )
      .execute();
    return getEntry(tx, id);
  });
}

/** Load entries by id (with lines and account names), preserving the requested order. */
export async function loadEntries(ctx: Ctx, ids: string[]): Promise<JournalEntryDto[]> {
  if (ids.length === 0) return [];
  const [entries, lines] = await Promise.all([
    ctx.db
      .selectFrom('journal_entries as e')
      .leftJoin('users as u', 'u.id', 'e.posted_by')
      .selectAll('e')
      .select('u.name as posted_by_name')
      .where('e.id', 'in', ids)
      .execute(),
    ctx.db
      .selectFrom('journal_lines as l')
      .innerJoin('accounts as a', 'a.id', 'l.account_id')
      .selectAll('l')
      .select(['a.code as account_code', 'a.name as account_name'])
      .where('l.entry_id', 'in', ids)
      .orderBy('l.position')
      .execute(),
  ]);
  const byEntry = new Map<string, JournalLineRow[]>();
  for (const line of lines) {
    const list = byEntry.get(line.entry_id) ?? [];
    list.push(line);
    byEntry.set(line.entry_id, list);
  }
  const byId = new Map<string, JournalEntryRow>(entries.map((e) => [e.id, e]));
  const out: JournalEntryDto[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) out.push(mapJournalEntry(entry, byEntry.get(id) ?? []));
  }
  return out;
}

export async function getEntry(ctx: WorkspaceCtx, id: string): Promise<JournalEntryDto> {
  const row = await ctx.db
    .selectFrom('journal_entries')
    .select('id')
    .where('id', '=', id)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!row) throw notFound('Journal entry');
  const [entry] = await loadEntries(ctx, [id]);
  if (!entry) throw notFound('Journal entry');
  return entry;
}

/** Entries whose `source_id` is one of the given ids (an invoice, its payments, an expense…). */
export async function entriesForSources(
  ctx: Ctx,
  workspaceId: string,
  sourceIds: string[],
): Promise<JournalEntryDto[]> {
  if (sourceIds.length === 0) return [];
  const rows = await ctx.db
    .selectFrom('journal_entries')
    .select('id')
    .where('workspace_id', '=', workspaceId)
    .where('source_id', 'in', sourceIds)
    .orderBy('entry_number')
    .execute();
  return loadEntries(
    ctx,
    rows.map((r) => r.id),
  );
}

/** The first entry recorded for a source of a given type, if any. */
export async function findEntryForSource(
  ctx: Ctx,
  workspaceId: string,
  sourceType: JournalSourceType,
  sourceId: string,
): Promise<string | null> {
  const row = await ctx.db
    .selectFrom('journal_entries')
    .select('id')
    .where('workspace_id', '=', workspaceId)
    .where('source_type', '=', sourceType)
    .where('source_id', '=', sourceId)
    .orderBy('entry_number')
    .executeTakeFirst();
  return row?.id ?? null;
}

export interface ReverseOptions {
  date?: string;
  memo?: string;
  /** Keep the original source id so the reversal shows up on the source record's timeline. */
  sourceId?: string | null;
}

/** Create a mirrored entry (debits ↔ credits) that cancels `entryId`. */
export async function reverseEntry(
  ctx: WorkspaceCtx,
  entryId: string,
  options: ReverseOptions = {},
): Promise<JournalEntryDto> {
  return withTransaction(ctx, async (tx) => {
    const original = await getEntry(tx, entryId);
    const existing = await tx.db
      .selectFrom('journal_entries')
      .select('id')
      .where('reversed_entry_id', '=', entryId)
      .executeTakeFirst();
    if (existing) throw conflict(`Entry #${original.entryNumber} has already been reversed`);
    const lines: PostingLine[] = reversePostings(original.lines).map((l) => ({
      account: { id: l.accountId },
      debitCents: l.debitCents,
      creditCents: l.creditCents,
      description: l.description,
    }));
    return postEntry(tx, {
      date: options.date ?? tx.clock.today(),
      memo: options.memo?.trim() || `Reversal of #${original.entryNumber}: ${original.memo}`,
      sourceType: 'reversal',
      sourceId: options.sourceId === undefined ? original.sourceId : options.sourceId,
      reversedEntryId: entryId,
      lines,
    });
  });
}

/** Manual reversal requested through the API (logs activity). */
export async function reverseEntryManually(
  ctx: WorkspaceCtx,
  entryId: string,
  options: ReverseOptions,
): Promise<JournalEntryDto> {
  return withTransaction(ctx, async (tx) => {
    const entry = await reverseEntry(tx, entryId, { ...options, sourceId: entryId });
    await logActivity(tx, {
      entityType: 'journal_entry',
      entityId: entry.id,
      action: 'reversed',
      summary: `${tx.user.name} reversed journal entry #${entry.reversedEntryId ? (await getEntry(tx, entry.reversedEntryId)).entryNumber : ''} as #${entry.entryNumber}`,
      meta: { reversedEntryId: entryId },
    });
    return entry;
  });
}

export async function createManualEntry(
  ctx: WorkspaceCtx,
  input: ManualJournalEntryInput,
): Promise<JournalEntryDto> {
  return withTransaction(ctx, async (tx) => {
    const accountIds = [...new Set(input.lines.map((l) => l.accountId))];
    const accounts = await tx.db
      .selectFrom('accounts')
      .select(['id', 'archived'])
      .where('workspace_id', '=', tx.workspace.id)
      .where('id', 'in', accountIds)
      .execute();
    const known = new Map(accounts.map((a) => [a.id, a] as const));
    input.lines.forEach((line, i) => {
      const account = known.get(line.accountId);
      if (!account) throw fieldError(`lines.${i}.accountId`, 'Account not found');
      if (account.archived) throw fieldError(`lines.${i}.accountId`, 'Account is archived');
    });
    const entry = await postEntry(tx, {
      date: input.date,
      memo: input.memo,
      sourceType: 'manual',
      lines: input.lines.map((l) => ({
        account: { id: l.accountId },
        debitCents: l.debitCents,
        creditCents: l.creditCents,
        description: l.description,
      })),
    });
    await logActivity(tx, {
      entityType: 'journal_entry',
      entityId: entry.id,
      action: 'posted',
      summary: `${tx.user.name} posted manual journal entry #${entry.entryNumber} "${entry.memo}"`,
      meta: { entryNumber: entry.entryNumber, totalCents: entry.totalDebitCents },
    });
    return entry;
  });
}

export interface JournalListQuery extends PageInput {
  from?: string;
  to?: string;
  accountId?: string;
  sourceType?: JournalSourceType;
  q?: string;
}

export async function listJournal(
  ctx: WorkspaceCtx,
  query: JournalListQuery,
): Promise<Paginated<JournalEntryDto>> {
  const page = resolvePage(query);
  let base = ctx.db
    .selectFrom('journal_entries as e')
    .where('e.workspace_id', '=', ctx.workspace.id);
  if (query.from) base = base.where('e.date', '>=', query.from);
  if (query.to) base = base.where('e.date', '<=', query.to);
  if (query.sourceType) base = base.where('e.source_type', '=', query.sourceType);
  if (query.q) base = base.where('e.memo', 'like', likeContains(query.q));
  if (query.accountId) {
    const accountId = query.accountId;
    base = base.where((eb) =>
      eb.exists(
        eb
          .selectFrom('journal_lines as l')
          .select('l.id')
          .whereRef('l.entry_id', '=', 'e.id')
          .where('l.account_id', '=', accountId),
      ),
    );
  }
  const [{ total }, rows] = await Promise.all([
    base.select((eb) => eb.fn.countAll<number>().as('total')).executeTakeFirstOrThrow(),
    base
      .select('e.id')
      .orderBy('e.date', 'desc')
      .orderBy('e.entry_number', 'desc')
      .limit(page.pageSize)
      .offset(page.offset)
      .execute(),
  ]);
  const items = await loadEntries(
    ctx,
    rows.map((r) => r.id),
  );
  return paginated(items, Number(total), page);
}
