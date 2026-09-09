import { describe, expect, it } from 'vitest';
import {
  hashString,
  isUuid,
  randomToken,
  SeededRandom,
  seededUuid,
  UUID_RE,
  uuidFromLabel,
} from './ids';

const draw = (rng: SeededRandom, n: number) => Array.from({ length: n }, () => rng.next());

describe('SeededRandom', () => {
  it('produces the same sequence for the same seed', () => {
    expect(draw(new SeededRandom(42), 10)).toEqual(draw(new SeededRandom(42), 10));
    expect(draw(new SeededRandom('northlight'), 10)).toEqual(
      draw(new SeededRandom('northlight'), 10),
    );
  });

  it('produces different sequences for different seeds', () => {
    expect(draw(new SeededRandom(1), 5)).not.toEqual(draw(new SeededRandom(2), 5));
    expect(draw(new SeededRandom('a'), 5)).not.toEqual(draw(new SeededRandom('b'), 5));
  });

  it('treats a zero seed as a fixed non-zero constant', () => {
    expect(draw(new SeededRandom(0), 5)).toEqual(draw(new SeededRandom(0x9e3779b9), 5));
  });

  it('yields floats in [0, 1)', () => {
    const rng = new SeededRandom(7);
    for (const v of draw(rng, 1000)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('int() stays within inclusive bounds and reaches both ends', () => {
    const rng = new SeededRandom('dice');
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) {
      const v = rng.int(1, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
      seen.add(v);
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6]);
    expect(new SeededRandom(3).int(5, 5)).toBe(5);
  });

  it('pick() returns an element and rejects empty arrays', () => {
    const rng = new SeededRandom(11);
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 20; i++) expect(items).toContain(rng.pick(items));
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it('chance() respects the extremes', () => {
    const rng = new SeededRandom(5);
    for (let i = 0; i < 50; i++) {
      expect(rng.chance(0)).toBe(false);
      expect(rng.chance(1)).toBe(true);
    }
  });

  it('shuffle() returns a permutation without mutating the input', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const rng = new SeededRandom('shuffle');
    const out = rng.shuffle(items);
    expect(out).toHaveLength(items.length);
    expect([...out].sort((a, b) => a - b)).toEqual(items);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(out).not.toEqual(items);
    expect(new SeededRandom('shuffle').shuffle(items)).toEqual(out);
  });

  it('sample() draws distinct elements', () => {
    const items = ['a', 'b', 'c', 'd', 'e'];
    const out = new SeededRandom(99).sample(items, 3);
    expect(out).toHaveLength(3);
    expect(new Set(out).size).toBe(3);
    for (const v of out) expect(items).toContain(v);
    expect(new SeededRandom(99).sample(items, 10)).toHaveLength(5);
  });
});

describe('hashString', () => {
  it('is deterministic and returns an unsigned 32-bit integer', () => {
    expect(hashString('')).toBe(2166136261);
    expect(hashString('abc')).toBe(hashString('abc'));
    expect(hashString('abc')).not.toBe(hashString('abd'));
    const h = hashString('Northlight Studio');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('seededUuid / uuidFromLabel', () => {
  it('produces RFC 4122 v4-shaped ids', () => {
    const rng = new SeededRandom(2024);
    for (let i = 0; i < 25; i++) {
      const id = seededUuid(rng);
      expect(id).toHaveLength(36);
      expect(id).toMatch(UUID_RE);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      expect(id[14]).toBe('4');
      expect('89ab').toContain(id[19] ?? '');
      expect(isUuid(id)).toBe(true);
    }
  });

  it('is deterministic per seed and varies between draws', () => {
    const a = seededUuid(new SeededRandom('x'));
    const b = seededUuid(new SeededRandom('x'));
    expect(a).toBe(b);
    const rng = new SeededRandom('x');
    expect(seededUuid(rng)).not.toBe(seededUuid(rng));
  });

  it('derives stable ids from labels', () => {
    expect(uuidFromLabel('client:acme')).toBe(uuidFromLabel('client:acme'));
    expect(uuidFromLabel('client:acme')).not.toBe(uuidFromLabel('client:other'));
    expect(uuidFromLabel('client:acme')).toMatch(UUID_RE);
  });
});

describe('isUuid', () => {
  it('validates shape, version and variant', () => {
    expect(isUuid('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuid('11111111-1111-1111-a111-111111111111')).toBe(true);
    expect(isUuid('11111111-1111-4111-8111-111111111111'.toUpperCase())).toBe(true);
    expect(isUuid('11111111-1111-4111-c111-111111111111')).toBe(false); // bad variant
    expect(isUuid('11111111-1111-6111-8111-111111111111')).toBe(false); // bad version
    expect(isUuid('11111111-1111-4111-8111-11111111111')).toBe(false); // short
    expect(isUuid('nope')).toBe(false);
    expect(isUuid(42)).toBe(false);
    expect(isUuid(null)).toBe(false);
  });
});

describe('randomToken', () => {
  it('produces lowercase hex of the requested length', () => {
    expect(randomToken()).toMatch(/^[0-9a-f]{32}$/);
    expect(randomToken(8)).toMatch(/^[0-9a-f]{8}$/);
    expect(randomToken(0)).toBe('');
  });

  it('uses the supplied random source', () => {
    expect(randomToken(4, () => 0)).toBe('0000');
    expect(randomToken(4, () => 0.999)).toBe('ffff');
    const rng = new SeededRandom('tok');
    const a = randomToken(16, () => rng.next());
    const rng2 = new SeededRandom('tok');
    expect(randomToken(16, () => rng2.next())).toBe(a);
  });
});
