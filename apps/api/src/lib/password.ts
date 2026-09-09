import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

/**
 * Hash a password with scrypt. Stored as `salt:hash` (both hex). A caller may supply the salt
 * (the seed does, for reproducible fixtures); otherwise 16 random bytes are used.
 */
export function hashPassword(
  password: string,
  salt: string = randomBytes(16).toString('hex'),
): string {
  const hash = scryptSync(password, salt, KEY_LENGTH, SCRYPT_OPTIONS).toString('hex');
  return `${salt}:${hash}`;
}

/** Constant-time verification of a password against a stored `salt:hash`. */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = scryptSync(password, salt, expected.length, SCRYPT_OPTIONS);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
