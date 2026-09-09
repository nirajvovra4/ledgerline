import { describe, expect, it } from 'vitest';
import { cx } from './cx';

describe('cx', () => {
  it('joins truthy strings and object keys', () => {
    expect(cx('a', false, null, undefined, 'b', { c: true, d: false }, 0, 3)).toBe('a b c 3');
  });
  it('returns empty string for nothing', () => {
    expect(cx()).toBe('');
  });
});
