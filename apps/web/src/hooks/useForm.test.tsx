import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { clientInputSchema, manualJournalEntrySchema } from '@ledgerline/shared';
import { ApiError } from '../api/client';
import { useForm } from './useForm';

describe('useForm', () => {
  it('maps zod issues to field errors and skips onSubmit', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        schema: clientInputSchema,
        initial: { name: '', email: 'not-an-email', paymentTermsDays: 30 },
        onSubmit,
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(result.current.errors.name).toBe('Client name is required');
    expect(result.current.errors.email).toBe('Enter a valid email address');
  });

  it('maps nested array issues to dotted paths', async () => {
    const { result } = renderHook(() =>
      useForm({
        schema: manualJournalEntrySchema,
        initial: {
          date: '2026-06-30',
          memo: 'x',
          lines: [{ accountId: 'bad', debitCents: 100, creditCents: 0, description: '' }],
        },
        onSubmit: vi.fn(),
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors['lines.0.accountId']).toBe('Invalid id');
    expect(result.current.errors.lines).toBe('An entry needs at least two lines');
  });

  it('clears a field error when the field changes and submits parsed data', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({ schema: clientInputSchema, initial: { name: '', paymentTermsDays: 30 }, onSubmit }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.name).toBeDefined();
    act(() => result.current.setValue('name', 'Acme'));
    expect(result.current.errors.name).toBeUndefined();
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({
      name: 'Acme',
      status: 'active',
      email: '',
    });
    expect(result.current.dirty).toBe(false);
  });

  it('surfaces server fieldErrors from ApiError and a general message otherwise', async () => {
    const { result } = renderHook(() =>
      useForm({
        schema: clientInputSchema,
        initial: { name: 'Acme', paymentTermsDays: 30 },
        onSubmit: async () => {
          throw new ApiError(409, 'conflict', 'Duplicate', [
            { path: 'name', message: 'Already exists', code: 'custom' },
          ]);
        },
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(result.current.errors.name).toBe('Already exists');
    expect(result.current.submitError).toBe('Duplicate');

    const { result: r2 } = renderHook(() =>
      useForm({
        schema: clientInputSchema,
        initial: { name: 'Acme', paymentTermsDays: 30 },
        onSubmit: async () => {
          throw new Error('Boom');
        },
      }),
    );
    await act(async () => {
      await r2.current.handleSubmit();
    });
    expect(r2.current.submitError).toBe('Boom');
    expect(r2.current.submitting).toBe(false);
  });

  it('applies transform before validating', async () => {
    const onSubmit = vi.fn();
    const { result } = renderHook(() =>
      useForm({
        schema: clientInputSchema,
        initial: { name: 'Acme', terms: '45' },
        transform: (v) => ({ name: v.name, paymentTermsDays: Number(v.terms) }),
        onSubmit,
      }),
    );
    await act(async () => {
      await result.current.handleSubmit();
    });
    expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ paymentTermsDays: 45 });
  });
});
