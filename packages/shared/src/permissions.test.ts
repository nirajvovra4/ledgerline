import { describe, expect, it } from 'vitest';
import {
  ALL_PERMISSIONS,
  assignableRoles,
  can,
  canAny,
  outranks,
  type Permission,
  ROLE_PERMISSIONS,
  ROLE_RANK,
} from './permissions';
import type { Role } from './types';

const ROLES: Role[] = ['owner', 'admin', 'accountant', 'member'];

/** The role matrix from docs/DESIGN.md §2 "Roles", column order owner | admin | accountant | member. */
const MATRIX: Array<[Permission, boolean, boolean, boolean, boolean]> = [
  ['workspace.manage', true, true, false, false],
  ['members.manage', true, true, false, false],
  ['clients.manage', true, true, true, false],
  ['clients.view', true, true, true, true],
  ['projects.manage', true, true, true, false],
  ['time.manage_own', true, true, true, true],
  ['time.manage_all', true, true, true, false],
  ['invoices.create', true, true, true, true],
  ['invoices.approve', true, true, true, false],
  ['invoices.send', true, true, true, false],
  ['invoices.void', true, true, true, false],
  ['payments.manage', true, true, true, false],
  ['expenses.create', true, true, true, true],
  ['expenses.approve', true, true, true, false],
  ['ledger.view', true, true, true, false],
  ['ledger.post', true, true, true, false],
  ['reports.view', true, true, true, false],
];

describe('role matrix', () => {
  it('covers every permission exactly once', () => {
    expect(MATRIX.map((r) => r[0]).sort()).toEqual([...ALL_PERMISSIONS].sort());
    expect(new Set(ALL_PERMISSIONS).size).toBe(ALL_PERMISSIONS.length);
    expect(ALL_PERMISSIONS).toHaveLength(17);
  });

  for (const [permission, owner, admin, accountant, member] of MATRIX) {
    it(`${permission}: owner=${owner} admin=${admin} accountant=${accountant} member=${member}`, () => {
      expect(can('owner', permission)).toBe(owner);
      expect(can('admin', permission)).toBe(admin);
      expect(can('accountant', permission)).toBe(accountant);
      expect(can('member', permission)).toBe(member);
    });
  }

  it('exposes the same matrix through ROLE_PERMISSIONS', () => {
    for (const role of ROLES) {
      const expected = MATRIX.filter((row) => row[1 + ROLES.indexOf(role)]).map((row) => row[0]);
      expect([...ROLE_PERMISSIONS[role]].sort()).toEqual(expected.sort());
    }
    expect(ROLE_PERMISSIONS.owner.size).toBe(17);
    expect(ROLE_PERMISSIONS.admin.size).toBe(17);
    expect(ROLE_PERMISSIONS.accountant.size).toBe(15);
    expect(ROLE_PERMISSIONS.member.size).toBe(4);
  });

  it('denies everything to a missing role', () => {
    for (const p of ALL_PERMISSIONS) {
      expect(can(null, p)).toBe(false);
      expect(can(undefined, p)).toBe(false);
    }
  });
});

describe('canAny', () => {
  it('is true when any permission is granted', () => {
    expect(canAny('member', ['workspace.manage', 'clients.view'])).toBe(true);
    expect(canAny('member', ['workspace.manage', 'members.manage'])).toBe(false);
    expect(canAny('member', [])).toBe(false);
    expect(canAny(null, ['clients.view'])).toBe(false);
  });
});

describe('outranks / ROLE_RANK', () => {
  it('orders owner > admin > accountant > member', () => {
    expect(ROLE_RANK.owner).toBeGreaterThan(ROLE_RANK.admin);
    expect(ROLE_RANK.admin).toBeGreaterThan(ROLE_RANK.accountant);
    expect(ROLE_RANK.accountant).toBeGreaterThan(ROLE_RANK.member);
    expect(outranks('owner', 'admin')).toBe(true);
    expect(outranks('admin', 'accountant')).toBe(true);
    expect(outranks('accountant', 'member')).toBe(true);
    expect(outranks('owner', 'member')).toBe(true);
  });

  it('is strict: equal roles and lower roles do not outrank', () => {
    expect(outranks('admin', 'owner')).toBe(false);
    expect(outranks('member', 'accountant')).toBe(false);
    for (const r of ROLES) expect(outranks(r, r)).toBe(false);
  });
});

describe('assignableRoles', () => {
  it('lets owners assign any role and admins anything but owner', () => {
    expect(assignableRoles('owner')).toEqual(['owner', 'admin', 'accountant', 'member']);
    expect(assignableRoles('admin')).toEqual(['admin', 'accountant', 'member']);
  });

  it('gives accountants and members nothing', () => {
    expect(assignableRoles('accountant')).toEqual([]);
    expect(assignableRoles('member')).toEqual([]);
  });
});
