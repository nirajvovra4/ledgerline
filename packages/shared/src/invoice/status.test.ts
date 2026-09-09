import { describe, expect, it } from 'vitest';
import type { InvoiceStatus, Role } from '../types';
import {
  canTransition,
  deriveInvoiceStatus,
  INVOICE_TRANSITIONS,
  invoiceActions,
  isEditableInvoice,
  isOpenInvoice,
  isPostedInvoice,
  OPEN_INVOICE_STATUSES,
  POSTED_INVOICE_STATUSES,
  statusAfterPayment,
} from './status';

const ALL: InvoiceStatus[] = [
  'draft',
  'pending_approval',
  'approved',
  'sent',
  'partially_paid',
  'paid',
  'void',
];

describe('INVOICE_TRANSITIONS', () => {
  it('matches the documented lifecycle', () => {
    expect(INVOICE_TRANSITIONS).toEqual({
      draft: ['pending_approval', 'approved', 'void'],
      pending_approval: ['approved', 'draft', 'void'],
      approved: ['sent', 'partially_paid', 'paid', 'void'],
      sent: ['partially_paid', 'paid', 'void'],
      partially_paid: ['paid', 'void'],
      paid: [],
      void: [],
    });
  });

  it('allows the happy path draft → pending_approval → approved → sent → partially_paid → paid', () => {
    const path: InvoiceStatus[] = [
      'draft',
      'pending_approval',
      'approved',
      'sent',
      'partially_paid',
      'paid',
    ];
    for (let i = 1; i < path.length; i++) {
      expect(canTransition(path[i - 1] as InvoiceStatus, path[i] as InvoiceStatus)).toBe(true);
    }
  });

  it('allows skipping approval and sending', () => {
    expect(canTransition('draft', 'approved')).toBe(true);
    expect(canTransition('approved', 'paid')).toBe(true);
    expect(canTransition('approved', 'partially_paid')).toBe(true);
  });

  it('lets a rejected invoice return to draft', () => {
    expect(canTransition('pending_approval', 'draft')).toBe(true);
  });

  it('allows void from every status except paid and void', () => {
    for (const s of ALL) {
      expect(canTransition(s, 'void')).toBe(s !== 'paid' && s !== 'void');
    }
  });

  it('forbids going backwards or out of terminal states', () => {
    expect(canTransition('draft', 'sent')).toBe(false);
    expect(canTransition('draft', 'paid')).toBe(false);
    expect(canTransition('sent', 'approved')).toBe(false);
    expect(canTransition('sent', 'draft')).toBe(false);
    expect(canTransition('approved', 'draft')).toBe(false);
    expect(canTransition('partially_paid', 'sent')).toBe(false);
    for (const s of ALL) {
      expect(canTransition('paid', s)).toBe(false);
      expect(canTransition('void', s)).toBe(false);
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('status predicates', () => {
  it('classifies open, posted and editable statuses', () => {
    expect(OPEN_INVOICE_STATUSES).toEqual(['approved', 'sent', 'partially_paid']);
    expect(POSTED_INVOICE_STATUSES).toEqual(['approved', 'sent', 'partially_paid', 'paid']);
    for (const s of ALL) {
      expect(isOpenInvoice(s)).toBe(OPEN_INVOICE_STATUSES.includes(s));
      expect(isPostedInvoice(s)).toBe(POSTED_INVOICE_STATUSES.includes(s));
      expect(isEditableInvoice(s)).toBe(s === 'draft');
    }
  });
});

describe('deriveInvoiceStatus', () => {
  const today = '2024-06-30';

  it('derives overdue only for sent and partially paid invoices past their due date', () => {
    expect(deriveInvoiceStatus({ status: 'sent', dueDate: '2024-06-29' }, today)).toBe('overdue');
    expect(deriveInvoiceStatus({ status: 'partially_paid', dueDate: '2024-01-01' }, today)).toBe(
      'overdue',
    );
    expect(deriveInvoiceStatus({ status: 'sent', dueDate: '2024-06-30' }, today)).toBe('sent');
    expect(deriveInvoiceStatus({ status: 'sent', dueDate: '2024-07-01' }, today)).toBe('sent');
    expect(deriveInvoiceStatus({ status: 'partially_paid', dueDate: '2024-06-30' }, today)).toBe(
      'partially_paid',
    );
  });

  it('never marks other statuses overdue', () => {
    for (const s of ['draft', 'pending_approval', 'approved', 'paid', 'void'] as InvoiceStatus[]) {
      expect(deriveInvoiceStatus({ status: s, dueDate: '2000-01-01' }, today)).toBe(s);
    }
  });
});

describe('statusAfterPayment', () => {
  it('moves to paid or partially paid based on the amount paid', () => {
    expect(statusAfterPayment('sent', 1000, 1000)).toBe('paid');
    expect(statusAfterPayment('sent', 1000, 1200)).toBe('paid');
    expect(statusAfterPayment('sent', 1000, 500)).toBe('partially_paid');
    expect(statusAfterPayment('approved', 1000, 1000)).toBe('paid');
    expect(statusAfterPayment('approved', 1000, 300)).toBe('partially_paid');
    expect(statusAfterPayment('partially_paid', 1000, 1000)).toBe('paid');
  });

  it('falls back to sent when payments are fully reversed', () => {
    expect(statusAfterPayment('paid', 1000, 0)).toBe('sent');
    expect(statusAfterPayment('partially_paid', 1000, 0)).toBe('sent');
    expect(statusAfterPayment('sent', 1000, 0)).toBe('sent');
    expect(statusAfterPayment('approved', 1000, 0)).toBe('approved');
  });

  it('leaves unposted and void invoices untouched', () => {
    expect(statusAfterPayment('draft', 1000, 1000)).toBe('draft');
    expect(statusAfterPayment('pending_approval', 1000, 1000)).toBe('pending_approval');
    expect(statusAfterPayment('void', 1000, 1000)).toBe('void');
  });
});

describe('invoiceActions', () => {
  const actions = (
    status: InvoiceStatus,
    role: Role | null,
    requireInvoiceApproval: boolean,
    balanceCents = 1000,
  ) => invoiceActions({ status, role, settings: { requireInvoiceApproval }, balanceCents });

  it('always offers print and duplicate first', () => {
    for (const s of ALL) {
      for (const role of ['owner', 'member', null] as Array<Role | null>) {
        expect(actions(s, role, true).slice(0, 2)).toEqual(['print', 'duplicate']);
      }
    }
  });

  describe('draft', () => {
    it('lets a member edit, delete and submit when approval is required', () => {
      expect(actions('draft', 'member', true)).toEqual([
        'print',
        'duplicate',
        'edit',
        'delete',
        'submit',
      ]);
    });

    it('offers a member no submit when approval is not required', () => {
      expect(actions('draft', 'member', false)).toEqual(['print', 'duplicate', 'edit', 'delete']);
    });

    it('lets approvers approve directly, alongside editing', () => {
      expect(actions('draft', 'accountant', true)).toEqual([
        'print',
        'duplicate',
        'edit',
        'delete',
        'submit',
        'approve',
      ]);
      expect(actions('draft', 'accountant', false)).toEqual([
        'print',
        'duplicate',
        'edit',
        'delete',
        'approve',
      ]);
      expect(actions('draft', 'owner', false)).toEqual([
        'print',
        'duplicate',
        'edit',
        'delete',
        'approve',
      ]);
      expect(actions('draft', 'admin', true)).toEqual(actions('draft', 'owner', true));
    });

    it('offers nothing beyond the basics without a role', () => {
      expect(actions('draft', null, true)).toEqual(['print', 'duplicate']);
    });
  });

  describe('pending_approval', () => {
    it('lets approvers approve, reject or void; members only look', () => {
      expect(actions('pending_approval', 'accountant', true)).toEqual([
        'print',
        'duplicate',
        'approve',
        'reject',
        'void',
      ]);
      expect(actions('pending_approval', 'owner', true)).toEqual([
        'print',
        'duplicate',
        'approve',
        'reject',
        'void',
      ]);
      expect(actions('pending_approval', 'member', true)).toEqual(['print', 'duplicate']);
    });
  });

  describe('approved', () => {
    it('lets privileged roles send, record a payment or void', () => {
      expect(actions('approved', 'accountant', true)).toEqual([
        'print',
        'duplicate',
        'send',
        'record_payment',
        'void',
      ]);
      expect(actions('approved', 'admin', false)).toEqual([
        'print',
        'duplicate',
        'send',
        'record_payment',
        'void',
      ]);
      expect(actions('approved', 'member', true)).toEqual(['print', 'duplicate']);
    });
  });

  describe('sent / partially_paid', () => {
    it('allows payments only while a balance remains', () => {
      expect(actions('sent', 'accountant', true, 500)).toEqual([
        'print',
        'duplicate',
        'record_payment',
        'void',
      ]);
      expect(actions('sent', 'accountant', true, 0)).toEqual(['print', 'duplicate', 'void']);
      expect(actions('partially_paid', 'owner', true, 1)).toEqual([
        'print',
        'duplicate',
        'record_payment',
        'void',
      ]);
      expect(actions('partially_paid', 'owner', true, 0)).toEqual(['print', 'duplicate', 'void']);
    });

    it('gives members nothing extra', () => {
      expect(actions('sent', 'member', true, 500)).toEqual(['print', 'duplicate']);
      expect(actions('partially_paid', 'member', false, 500)).toEqual(['print', 'duplicate']);
    });
  });

  describe('paid / void', () => {
    it('offers only the basics to everyone', () => {
      for (const role of ['owner', 'admin', 'accountant', 'member', null] as Array<Role | null>) {
        expect(actions('paid', role, true)).toEqual(['print', 'duplicate']);
        expect(actions('void', role, false)).toEqual(['print', 'duplicate']);
      }
    });
  });

  it('never gives members send, void, approve or record_payment', () => {
    for (const s of ALL) {
      for (const require of [true, false]) {
        const a = actions(s, 'member', require, 500);
        expect(a).not.toContain('send');
        expect(a).not.toContain('void');
        expect(a).not.toContain('approve');
        expect(a).not.toContain('reject');
        expect(a).not.toContain('record_payment');
      }
    }
  });
});
