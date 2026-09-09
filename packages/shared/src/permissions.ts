import type { Role } from './types';

export type Permission =
  | 'workspace.manage'
  | 'members.manage'
  | 'clients.manage'
  | 'clients.view'
  | 'projects.manage'
  | 'time.manage_own'
  | 'time.manage_all'
  | 'invoices.create'
  | 'invoices.approve'
  | 'invoices.send'
  | 'invoices.void'
  | 'payments.manage'
  | 'expenses.create'
  | 'expenses.approve'
  | 'ledger.view'
  | 'ledger.post'
  | 'reports.view';

export const ALL_PERMISSIONS: Permission[] = [
  'workspace.manage',
  'members.manage',
  'clients.manage',
  'clients.view',
  'projects.manage',
  'time.manage_own',
  'time.manage_all',
  'invoices.create',
  'invoices.approve',
  'invoices.send',
  'invoices.void',
  'payments.manage',
  'expenses.create',
  'expenses.approve',
  'ledger.view',
  'ledger.post',
  'reports.view',
];

const ACCOUNTANT: Permission[] = [
  'clients.manage',
  'clients.view',
  'projects.manage',
  'time.manage_own',
  'time.manage_all',
  'invoices.create',
  'invoices.approve',
  'invoices.send',
  'invoices.void',
  'payments.manage',
  'expenses.create',
  'expenses.approve',
  'ledger.view',
  'ledger.post',
  'reports.view',
];

const MEMBER: Permission[] = [
  'clients.view',
  'time.manage_own',
  'invoices.create',
  'expenses.create',
];

export const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission>> = {
  owner: new Set(ALL_PERMISSIONS),
  admin: new Set(ALL_PERMISSIONS),
  accountant: new Set(ACCOUNTANT),
  member: new Set(MEMBER),
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role].has(permission);
}

export function canAny(role: Role | null | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => can(role, p));
}

/** Roles ordered from most to least privileged. */
export const ROLE_RANK: Record<Role, number> = { owner: 4, admin: 3, accountant: 2, member: 1 };

export function outranks(a: Role, b: Role): boolean {
  return ROLE_RANK[a] > ROLE_RANK[b];
}

/** Which roles a user with `actor` role may assign to others. */
export function assignableRoles(actor: Role): Role[] {
  if (actor === 'owner') return ['owner', 'admin', 'accountant', 'member'];
  if (actor === 'admin') return ['admin', 'accountant', 'member'];
  return [];
}
