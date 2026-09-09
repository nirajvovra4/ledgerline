import {
  DEFAULT_WORKSPACE_SETTINGS,
  slugify,
  type CreateWorkspaceInput,
  type Role,
  type UpdateWorkspaceInput,
  type WorkspaceDto,
  type WorkspaceSettings,
  type WorkspaceSummary,
} from '@ledgerline/shared';
import { conflict, fieldError, notFound } from '../errors';
import { newId } from '../lib/ids';
import { mapWorkspace } from '../mappers';
import { createSystemAccounts } from './accounts';
import { logActivity } from './activity';
import {
  toWorkspaceRecord,
  withTransaction,
  type Ctx,
  type UserRow,
  type WorkspaceCtx,
  type WorkspaceRecord,
} from './context';

export async function listWorkspacesForUser(ctx: Ctx, userId: string): Promise<WorkspaceSummary[]> {
  const rows = await ctx.db
    .selectFrom('memberships as m')
    .innerJoin('workspaces as w', 'w.id', 'm.workspace_id')
    .select((eb) => [
      'w.id',
      'w.name',
      'w.slug',
      'w.currency',
      'm.role',
      eb
        .selectFrom('memberships as m2')
        .select(eb.fn.countAll<number>().as('c'))
        .whereRef('m2.workspace_id', '=', 'w.id')
        .as('member_count'),
    ])
    .where('m.user_id', '=', userId)
    .orderBy('w.name')
    .execute();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    currency: r.currency,
    role: r.role,
    memberCount: Number(r.member_count ?? 0),
  }));
}

export async function summaryFor(
  ctx: Ctx,
  workspaceId: string,
  role: Role,
): Promise<WorkspaceSummary> {
  const row = await ctx.db
    .selectFrom('workspaces')
    .select(['id', 'name', 'slug', 'currency'])
    .where('id', '=', workspaceId)
    .executeTakeFirstOrThrow();
  const { c } = await ctx.db
    .selectFrom('memberships')
    .select((eb) => eb.fn.countAll<number>().as('c'))
    .where('workspace_id', '=', workspaceId)
    .executeTakeFirstOrThrow();
  return { ...row, role, memberCount: Number(c) };
}

/** Workspace by slug together with the caller's membership role (null when not a member). */
export async function findWorkspaceBySlug(
  ctx: Ctx,
  slug: string,
  userId: string,
): Promise<{ workspace: WorkspaceRecord; role: Role | null } | null> {
  const row = await ctx.db
    .selectFrom('workspaces')
    .selectAll()
    .where('slug', '=', slug)
    .executeTakeFirst();
  if (!row) return null;
  const membership = await ctx.db
    .selectFrom('memberships')
    .select('role')
    .where('workspace_id', '=', row.id)
    .where('user_id', '=', userId)
    .executeTakeFirst();
  return { workspace: toWorkspaceRecord(row), role: membership?.role ?? null };
}

export async function loadWorkspace(ctx: Ctx, id: string): Promise<WorkspaceRecord> {
  const row = await ctx.db
    .selectFrom('workspaces')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  if (!row) throw notFound('Workspace');
  return toWorkspaceRecord(row);
}

export interface CreateWorkspaceOptions {
  /** Override the default settings (used by the seed). */
  settings?: Partial<WorkspaceSettings>;
}

/** Create a workspace with its system chart of accounts and make `user` the owner. */
export async function createWorkspace(
  ctx: Ctx,
  user: UserRow,
  input: CreateWorkspaceInput,
  options: CreateWorkspaceOptions = {},
): Promise<WorkspaceDto> {
  return withTransaction(ctx, async (tx) => {
    const slug = input.slug?.trim() || slugify(input.name);
    if (!slug) throw fieldError('slug', 'Choose a slug for the workspace');
    const existing = await tx.db
      .selectFrom('workspaces')
      .select('id')
      .where('slug', '=', slug)
      .executeTakeFirst();
    if (existing)
      throw conflict(`The address "${slug}" is already taken`, [
        { path: 'slug', message: 'Slug already in use' },
      ]);

    const id = newId();
    const now = tx.clock.now();
    const settings: WorkspaceSettings = { ...DEFAULT_WORKSPACE_SETTINGS, ...options.settings };
    await tx.db
      .insertInto('workspaces')
      .values({
        id,
        name: input.name.trim(),
        slug,
        currency: input.currency,
        settings: JSON.stringify(settings),
        created_at: now,
        updated_at: now,
      })
      .execute();
    await tx.db
      .insertInto('memberships')
      .values({ workspace_id: id, user_id: user.id, role: 'owner', created_at: now })
      .execute();
    await createSystemAccounts(tx, id);

    const workspace = await loadWorkspace(tx, id);
    await logActivity(
      { ...tx, workspace, user, role: 'owner' },
      {
        entityType: 'workspace',
        entityId: id,
        action: 'created',
        summary: `${user.name} created the workspace ${workspace.name}`,
      },
    );
    return mapWorkspace(workspace);
  });
}

export async function updateWorkspace(
  ctx: WorkspaceCtx,
  input: UpdateWorkspaceInput,
): Promise<WorkspaceDto> {
  return withTransaction(ctx, async (tx) => {
    const current = tx.workspace;
    const settings: WorkspaceSettings = { ...current.settings, ...(input.settings ?? {}) };
    if (settings.defaultTaxRateId) {
      const rate = await tx.db
        .selectFrom('tax_rates')
        .select('id')
        .where('id', '=', settings.defaultTaxRateId)
        .where('workspace_id', '=', current.id)
        .executeTakeFirst();
      if (!rate) throw fieldError('settings.defaultTaxRateId', 'Tax rate not found');
    }
    await tx.db
      .updateTable('workspaces')
      .set({
        name: input.name?.trim() ?? current.name,
        currency: input.currency ?? current.currency,
        settings: JSON.stringify(settings),
        updated_at: tx.clock.now(),
      })
      .where('id', '=', current.id)
      .execute();
    const workspace = await loadWorkspace(tx, current.id);
    await logActivity(
      { ...tx, workspace },
      {
        entityType: 'workspace',
        entityId: workspace.id,
        action: 'updated',
        summary: `${tx.user.name} updated workspace settings`,
        meta: {
          fields: Object.keys(input.settings ?? {}).concat(
            input.name ? ['name'] : [],
            input.currency ? ['currency'] : [],
          ),
        },
      },
    );
    return mapWorkspace(workspace);
  });
}

/** Persist just the settings blob (used by the invoice numbering sequence inside a transaction). */
export async function saveSettings(
  ctx: Ctx,
  workspaceId: string,
  settings: WorkspaceSettings,
): Promise<void> {
  await ctx.db
    .updateTable('workspaces')
    .set({ settings: JSON.stringify(settings), updated_at: ctx.clock.now() })
    .where('id', '=', workspaceId)
    .execute();
}
