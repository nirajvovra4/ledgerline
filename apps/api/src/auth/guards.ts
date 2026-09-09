import {
  can,
  SESSION_COOKIE,
  SESSION_TTL_DAYS,
  type Permission,
  type Role,
} from '@ledgerline/shared';
import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import { forbidden, notFound, unauthenticated } from '../errors';
import { userForSession } from '../services/auth';
import type { Ctx, UserRow, WorkspaceCtx, WorkspaceRecord } from '../services/context';
import { findWorkspaceBySlug } from '../services/workspaces';

export interface WorkspaceScope {
  workspace: WorkspaceRecord;
  role: Role;
}

declare module 'fastify' {
  interface FastifyInstance {
    /** Database + clock shared by every request. */
    ctx: Ctx;
    /** Whether session cookies should be marked `secure` for HTTPS requests. */
    secureCookies: boolean;
  }
  interface FastifyRequest {
    user: UserRow | null;
    sessionToken: string | null;
    ws: WorkspaceScope | null;
  }
}

/** onRequest hook: resolve the session cookie to a user (never fails; guards decide later). */
export async function attachUser(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  request.sessionToken = token ?? null;
  request.user = token ? await userForSession(request.server.ctx, token) : null;
}

export const requireUser: preHandlerHookHandler = async (request) => {
  if (!request.user) throw unauthenticated();
};

/**
 * Load the workspace named by `:slug`, verify membership and (optionally) a permission. The
 * result is attached as `request.ws` so handlers can build a `WorkspaceCtx`.
 */
export function requireWorkspace(permission?: Permission): preHandlerHookHandler {
  return async (request) => {
    if (!request.user) throw unauthenticated();
    const { slug } = request.params as { slug?: string };
    if (!slug) throw notFound('Workspace');
    const found = await findWorkspaceBySlug(request.server.ctx, slug, request.user.id);
    if (!found) throw notFound('Workspace');
    if (!found.role) throw forbidden('You are not a member of this workspace');
    request.ws = { workspace: found.workspace, role: found.role };
    if (permission && !can(found.role, permission)) throw forbidden();
  };
}

/** Per-route permission check for routes registered under a workspace plugin. */
export function requirePermission(...permissions: Permission[]): preHandlerHookHandler {
  return async (request) => {
    if (!request.ws) throw unauthenticated();
    const role = request.ws.role;
    if (!permissions.some((p) => can(role, p))) throw forbidden();
  };
}

export function userOf(request: FastifyRequest): UserRow {
  if (!request.user) throw unauthenticated();
  return request.user;
}

/** Build the service context for a workspace-scoped request. */
export function wctx(request: FastifyRequest): WorkspaceCtx {
  if (!request.user || !request.ws) throw unauthenticated();
  return {
    ...request.server.ctx,
    workspace: request.ws.workspace,
    user: request.user,
    role: request.ws.role,
  };
}

/**
 * The cookie lifetime is relative (`Max-Age`) rather than an absolute `Expires`, because the API
 * may run on a pinned demo clock while browsers judge expiry by the real wall clock.
 */
export function setSessionCookie(
  request: FastifyRequest,
  reply: FastifyReply,
  token: string,
): void {
  reply.setCookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    secure: request.server.secureCookies && request.protocol === 'https',
    maxAge: SESSION_TTL_DAYS * 86_400,
  });
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}
