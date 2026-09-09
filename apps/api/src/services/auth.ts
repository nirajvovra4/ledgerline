import {
  SESSION_TTL_DAYS,
  type ChangePasswordInput,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
  type UserDto,
  type WorkspaceSummary,
} from '@ledgerline/shared';
import { conflict, fieldError, unauthenticated } from '../errors';
import { newId, newToken } from '../lib/ids';
import { hashPassword, verifyPassword } from '../lib/password';
import { mapUser } from '../mappers';
import { withTransaction, type Ctx, type UserRow } from './context';
import { acceptInvite } from './members';
import { listWorkspacesForUser } from './workspaces';

export interface SessionInfo {
  token: string;
  expiresAt: string;
}

/** Sessions are opaque random tokens stored server-side; expiry is enforced on every request. */
export async function createSession(ctx: Ctx, userId: string): Promise<SessionInfo> {
  const token = newToken(32);
  const now = new Date(ctx.clock.now());
  const expiresAt = new Date(now.getTime() + SESSION_TTL_DAYS * 86_400_000).toISOString();
  await ctx.db
    .insertInto('sessions')
    .values({ id: token, user_id: userId, expires_at: expiresAt, created_at: now.toISOString() })
    .execute();
  return { token, expiresAt };
}

export async function destroySession(ctx: Ctx, token: string): Promise<void> {
  await ctx.db.deleteFrom('sessions').where('id', '=', token).execute();
}

/** Resolve a session token to its user, or null when missing/expired. */
export async function userForSession(ctx: Ctx, token: string): Promise<UserRow | null> {
  const row = await ctx.db
    .selectFrom('sessions as s')
    .innerJoin('users as u', 'u.id', 's.user_id')
    .select(['u.id', 'u.email', 'u.name', 'u.created_at', 's.expires_at'])
    .where('s.id', '=', token)
    .executeTakeFirst();
  if (!row) return null;
  if (row.expires_at <= ctx.clock.now()) {
    await destroySession(ctx, token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, created_at: row.created_at };
}

export interface CreateUserOptions {
  /** Deterministic salt for seeded fixtures. */
  salt?: string;
}

export async function createUser(
  ctx: Ctx,
  input: { name: string; email: string; password: string },
  options: CreateUserOptions = {},
): Promise<UserRow> {
  const email = input.email.trim().toLowerCase();
  const existing = await ctx.db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email)
    .executeTakeFirst();
  if (existing)
    throw conflict('An account with that email already exists', [
      { path: 'email', message: 'Email already registered' },
    ]);
  const now = ctx.clock.now();
  const id = newId();
  await ctx.db
    .insertInto('users')
    .values({
      id,
      email,
      name: input.name.trim(),
      password_hash: hashPassword(input.password, options.salt),
      created_at: now,
      updated_at: now,
    })
    .execute();
  return { id, email, name: input.name.trim(), created_at: now };
}

export async function register(
  ctx: Ctx,
  input: RegisterInput,
): Promise<{ user: UserDto; session: SessionInfo }> {
  return withTransaction(ctx, async (tx) => {
    const user = await createUser(tx, input);
    if (input.inviteToken) {
      // A bad token should not block sign-up; the invite page can retry the accept call.
      await acceptInvite(tx, user, input.inviteToken).catch(() => null);
    }
    const session = await createSession(tx, user.id);
    return { user: mapUser(user), session };
  });
}

export async function login(
  ctx: Ctx,
  input: LoginInput,
): Promise<{ user: UserDto; session: SessionInfo }> {
  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('email', '=', input.email.trim().toLowerCase())
    .executeTakeFirst();
  if (!row || !verifyPassword(input.password, row.password_hash)) {
    throw unauthenticated('Incorrect email or password');
  }
  const session = await createSession(ctx, row.id);
  return { user: mapUser(row), session };
}

export async function me(
  ctx: Ctx,
  user: UserRow,
): Promise<{ user: UserDto; workspaces: WorkspaceSummary[] }> {
  return { user: mapUser(user), workspaces: await listWorkspacesForUser(ctx, user.id) };
}

export async function updateProfile(
  ctx: Ctx,
  user: UserRow,
  input: UpdateProfileInput,
): Promise<UserDto> {
  const email = input.email.trim().toLowerCase();
  const clash = await ctx.db
    .selectFrom('users')
    .select('id')
    .where('email', '=', email)
    .where('id', '!=', user.id)
    .executeTakeFirst();
  if (clash)
    throw conflict('An account with that email already exists', [
      { path: 'email', message: 'Email already registered' },
    ]);
  await ctx.db
    .updateTable('users')
    .set({ name: input.name.trim(), email, updated_at: ctx.clock.now() })
    .where('id', '=', user.id)
    .execute();
  const row = await ctx.db
    .selectFrom('users')
    .selectAll()
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();
  return mapUser(row);
}

export async function changePassword(
  ctx: Ctx,
  user: UserRow,
  input: ChangePasswordInput,
): Promise<void> {
  const row = await ctx.db
    .selectFrom('users')
    .select('password_hash')
    .where('id', '=', user.id)
    .executeTakeFirstOrThrow();
  if (!verifyPassword(input.currentPassword, row.password_hash)) {
    throw fieldError('currentPassword', 'Current password is incorrect');
  }
  await ctx.db
    .updateTable('users')
    .set({ password_hash: hashPassword(input.newPassword), updated_at: ctx.clock.now() })
    .where('id', '=', user.id)
    .execute();
}
