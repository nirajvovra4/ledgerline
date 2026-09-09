import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { firstIssueMessage, formatIssues, issuesByField, validate } from './validation';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  amount: z.number().int('Whole cents only'),
  lines: z.array(z.object({ qty: z.number().positive('Must be positive') })),
});

describe('validate', () => {
  it('returns ok with parsed data', () => {
    const result = validate(schema, { name: 'x', amount: 1, lines: [{ qty: 1 }] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toEqual({ name: 'x', amount: 1, lines: [{ qty: 1 }] });
  });

  it('returns issues with dotted paths on failure', () => {
    const result = validate(schema, { name: '', amount: 1.5, lines: [{ qty: 1 }, { qty: -1 }] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toEqual([
      { path: 'name', message: 'Name is required', code: 'too_small' },
      { path: 'amount', message: 'Whole cents only', code: 'invalid_type' },
      { path: 'lines.1.qty', message: 'Must be positive', code: 'too_small' },
    ]);
  });

  it('applies schema transforms and defaults', () => {
    const result = validate(z.object({ a: z.string().trim(), b: z.number().default(3) }), {
      a: '  hi ',
    });
    expect(result).toEqual({ ok: true, data: { a: 'hi', b: 3 } });
  });

  it('reports a root-level issue with an empty path', () => {
    const result = validate(z.number(), 'nope');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues[0]).toMatchObject({ path: '', code: 'invalid_type' });
  });
});

describe('formatIssues', () => {
  it('formats a ZodError', () => {
    const parsed = schema.safeParse({ name: 'x', amount: 'y', lines: [] });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(formatIssues(parsed.error)).toEqual([
      { path: 'amount', message: 'Expected number, received string', code: 'invalid_type' },
    ]);
  });

  it('accepts any object with an issues array', () => {
    const issues = formatIssues({
      issues: [
        { code: 'custom', path: ['lines', 0, 'accountId'], message: 'Pick an account' },
        { code: 'custom', path: [], message: 'Root' },
      ],
    });
    expect(issues).toEqual([
      { path: 'lines.0.accountId', message: 'Pick an account', code: 'custom' },
      { path: '', message: 'Root', code: 'custom' },
    ]);
  });
});

describe('issuesByField', () => {
  it('keeps the first message per field', () => {
    const map = issuesByField([
      { path: 'a', message: 'first', code: 'x' },
      { path: 'a', message: 'second', code: 'y' },
      { path: 'b', message: 'only', code: 'z' },
    ]);
    expect(map).toEqual({ a: 'first', b: 'only' });
  });

  it('files root issues under "_"', () => {
    expect(issuesByField([{ path: '', message: 'root', code: 'custom' }])).toEqual({ _: 'root' });
    expect(issuesByField([])).toEqual({});
  });
});

describe('firstIssueMessage', () => {
  it('returns the first message or a fallback', () => {
    expect(firstIssueMessage([{ path: 'a', message: 'oops', code: 'x' }])).toBe('oops');
    expect(firstIssueMessage([])).toBe('Please check the form.');
    expect(firstIssueMessage([], 'Custom')).toBe('Custom');
  });
});
