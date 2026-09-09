import { describe, expect, it } from 'vitest';
import type { ExpenseStatus, Role } from '../types';
import { canTransitionExpense, EXPENSE_TRANSITIONS, expenseActions, isEditableExpense, isPostedExpense } from './status';

const ALL: ExpenseStatus[] = ['draft', 'pending_approval', 'approved', 'paid', 'rejected'];

describe('EXPENSE_TRANSITIONS', () => {
  it('matches the documented lifecycle', () => {
    expect(EXPENSE_TRANSITIONS).toEqual({
      draft: ['pending_approval', 'approved'],
      pending_approval: ['approved', 'rejected'],
      approved: ['paid'],
      paid: [],
      rejected: ['draft', 'pending_approval'],
    });
  });

  it('allows the happy path and direct approval', () => {
    expect(canTransitionExpense('draft', 'pending_approval')).toBe(true);
    expect(canTransitionExpense('pending_approval', 'approved')).toBe(true);
    expect(canTransitionExpense('approved', 'paid')).toBe(true);
    expect(canTransitionExpense('draft', 'approved')).toBe(true);
  });

  it('routes rejection back through draft or resubmission', () => {
    expect(canTransitionExpense('pending_approval', 'rejected')).toBe(true);
    expect(canTransitionExpense('rejected', 'draft')).toBe(true);
    expect(canTransitionExpense('rejected', 'pending_approval')).toBe(true);
    expect(canTransitionExpense('rejected', 'approved')).toBe(false);
  });

  it('forbids invalid moves and leaving paid', () => {
    expect(canTransitionExpense('draft', 'paid')).toBe(false);
    expect(canTransitionExpense('draft', 'rejected')).toBe(false);
    expect(canTransitionExpense('approved', 'rejected')).toBe(false);
    expect(canTransitionExpense('approved', 'draft')).toBe(false);
    for (const s of ALL) {
      expect(canTransitionExpense('paid', s)).toBe(false);
      expect(canTransitionExpense(s, s)).toBe(false);
    }
  });

  it('classifies editable and posted statuses', () => {
    for (const s of ALL) {
      expect(isEditableExpense(s)).toBe(s === 'draft' || s === 'rejected');
      expect(isPostedExpense(s)).toBe(s === 'approved' || s === 'paid');
    }
  });
});

describe('expenseActions', () => {
  const actions = (status: ExpenseStatus, role: Role | null, isCreator: boolean, requireExpenseApproval = true) =>
    expenseActions({ status, role, settings: { requireExpenseApproval }, isCreator });

  describe('draft', () => {
    it('lets the creating member edit, delete and submit', () => {
      expect(actions('draft', 'member', true)).toEqual(['edit', 'delete', 'submit']);
      expect(actions('draft', 'member', true, false)).toEqual(['edit', 'delete']);
    });

    it('gives a non-creating member nothing', () => {
      expect(actions('draft', 'member', false)).toEqual([]);
      expect(actions('draft', 'member', false, false)).toEqual([]);
    });

    it('lets approvers edit anyone’s draft and approve it', () => {
      expect(actions('draft', 'accountant', false)).toEqual(['edit', 'delete', 'submit', 'approve']);
      expect(actions('draft', 'accountant', false, false)).toEqual(['edit', 'delete', 'approve']);
      expect(actions('draft', 'owner', true)).toEqual(['edit', 'delete', 'submit', 'approve']);
      expect(actions('draft', 'admin', false)).toEqual(actions('draft', 'accountant', false));
    });

    it('offers nothing without a role', () => {
      expect(actions('draft', null, true)).toEqual([]);
    });
  });

  describe('rejected', () => {
    it('can be edited and resubmitted but not deleted', () => {
      expect(actions('rejected', 'member', true)).toEqual(['edit', 'submit']);
      expect(actions('rejected', 'member', true, false)).toEqual(['edit']);
      expect(actions('rejected', 'member', false)).toEqual([]);
      expect(actions('rejected', 'accountant', false)).toEqual(['edit', 'submit', 'approve']);
    });
  });

  describe('pending_approval', () => {
    it('only approvers can decide', () => {
      expect(actions('pending_approval', 'accountant', false)).toEqual(['approve', 'reject']);
      expect(actions('pending_approval', 'owner', true)).toEqual(['approve', 'reject']);
      expect(actions('pending_approval', 'member', true)).toEqual([]);
    });
  });

  describe('approved', () => {
    it('only approvers can pay', () => {
      expect(actions('approved', 'accountant', false)).toEqual(['pay']);
      expect(actions('approved', 'admin', false)).toEqual(['pay']);
      expect(actions('approved', 'member', true)).toEqual([]);
    });
  });

  describe('paid', () => {
    it('is terminal for everyone', () => {
      for (const role of ['owner', 'admin', 'accountant', 'member', null] as Array<Role | null>) {
        expect(actions('paid', role, true)).toEqual([]);
      }
    });
  });

  it('never lets members approve, reject or pay', () => {
    for (const s of ALL) {
      for (const creator of [true, false]) {
        const a = actions(s, 'member', creator);
        expect(a).not.toContain('approve');
        expect(a).not.toContain('reject');
        expect(a).not.toContain('pay');
      }
    }
  });
});
