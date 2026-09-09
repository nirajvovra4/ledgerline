import type { TaxRateDto, TaxRateInput } from '@ledgerline/shared';
import { notFound } from '../errors';
import { toDbBool } from '../db/schema';
import { newId } from '../lib/ids';
import { mapTaxRate } from '../mappers';
import { logActivity } from './activity';
import { withTransaction, type Ctx, type WorkspaceCtx } from './context';
import { loadWorkspace, saveSettings } from './workspaces';

export async function listTaxRates(
  ctx: WorkspaceCtx,
  includeArchived = true,
): Promise<TaxRateDto[]> {
  let q = ctx.db
    .selectFrom('tax_rates')
    .selectAll()
    .where('workspace_id', '=', ctx.workspace.id)
    .orderBy('rate_bp', 'desc')
    .orderBy('name');
  if (!includeArchived) q = q.where('archived', '=', 0);
  return (await q.execute()).map(mapTaxRate);
}

export async function getTaxRate(ctx: WorkspaceCtx, id: string): Promise<TaxRateDto> {
  const row = await ctx.db
    .selectFrom('tax_rates')
    .selectAll()
    .where('id', '=', id)
    .where('workspace_id', '=', ctx.workspace.id)
    .executeTakeFirst();
  if (!row) throw notFound('Tax rate');
  return mapTaxRate(row);
}

/** Look up a rate's basis points within the workspace (null when the id is unknown). */
export async function taxRateBp(
  ctx: Ctx,
  workspaceId: string,
  id: string | null,
): Promise<{ id: string; rateBp: number; name: string } | null> {
  if (!id) return null;
  const row = await ctx.db
    .selectFrom('tax_rates')
    .select(['id', 'rate_bp', 'name'])
    .where('id', '=', id)
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirst();
  return row ? { id: row.id, rateBp: row.rate_bp, name: row.name } : null;
}

async function setDefault(ctx: WorkspaceCtx, id: string | null): Promise<void> {
  await ctx.db
    .updateTable('tax_rates')
    .set({ is_default: 0 })
    .where('workspace_id', '=', ctx.workspace.id)
    .execute();
  if (id)
    await ctx.db.updateTable('tax_rates').set({ is_default: 1 }).where('id', '=', id).execute();
  const workspace = await loadWorkspace(ctx, ctx.workspace.id);
  await saveSettings(ctx, ctx.workspace.id, { ...workspace.settings, defaultTaxRateId: id });
}

export async function createTaxRate(ctx: WorkspaceCtx, input: TaxRateInput): Promise<TaxRateDto> {
  return withTransaction(ctx, async (tx) => {
    const id = newId();
    await tx.db
      .insertInto('tax_rates')
      .values({
        id,
        workspace_id: tx.workspace.id,
        name: input.name,
        rate_bp: input.rateBp,
        is_default: 0,
        archived: 0,
      })
      .execute();
    if (input.isDefault) await setDefault(tx, id);
    await logActivity(tx, {
      entityType: 'workspace',
      entityId: tx.workspace.id,
      action: 'tax_rate_created',
      summary: `${tx.user.name} added tax rate ${input.name} (${input.rateBp / 100}%)`,
      meta: { taxRateId: id },
    });
    return getTaxRate(tx, id);
  });
}

export async function updateTaxRate(
  ctx: WorkspaceCtx,
  id: string,
  input: Partial<TaxRateInput> & { archived?: boolean },
): Promise<TaxRateDto> {
  return withTransaction(ctx, async (tx) => {
    const existing = await tx.db
      .selectFrom('tax_rates')
      .selectAll()
      .where('id', '=', id)
      .where('workspace_id', '=', tx.workspace.id)
      .executeTakeFirst();
    if (!existing) throw notFound('Tax rate');
    await tx.db
      .updateTable('tax_rates')
      .set({
        name: input.name ?? existing.name,
        rate_bp: input.rateBp ?? existing.rate_bp,
        archived: input.archived === undefined ? existing.archived : toDbBool(input.archived),
      })
      .where('id', '=', id)
      .execute();
    if (input.isDefault === true) await setDefault(tx, id);
    else if ((input.isDefault === false || input.archived) && existing.is_default)
      await setDefault(tx, null);
    await logActivity(tx, {
      entityType: 'workspace',
      entityId: tx.workspace.id,
      action: input.archived ? 'tax_rate_archived' : 'tax_rate_updated',
      summary: `${tx.user.name} ${input.archived ? 'archived' : 'updated'} tax rate ${input.name ?? existing.name}`,
      meta: { taxRateId: id },
    });
    return getTaxRate(tx, id);
  });
}

export async function archiveTaxRate(ctx: WorkspaceCtx, id: string): Promise<TaxRateDto> {
  return updateTaxRate(ctx, id, { archived: true });
}
