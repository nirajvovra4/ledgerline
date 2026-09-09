import { randomBytes, randomUUID } from 'node:crypto';

/**
 * Identifier and token generation with a swappable source. The API uses cryptographic randomness;
 * the seed script temporarily installs a seeded generator so demo IDs are identical on every run.
 */
export interface IdSource {
  uuid(): string;
  token(bytes: number): string;
}

const cryptoSource: IdSource = {
  uuid: () => randomUUID(),
  token: (bytes) => randomBytes(bytes).toString('hex'),
};

let current: IdSource = cryptoSource;

export function newId(): string {
  return current.uuid();
}

/** Hex token of `bytes * 2` characters (32 bytes → 64 hex chars). */
export function newToken(bytes = 32): string {
  return current.token(bytes);
}

/** Run `fn` with a different id source (used by the seed), restoring the default afterwards. */
export async function withIdSource<T>(source: IdSource, fn: () => Promise<T>): Promise<T> {
  const previous = current;
  current = source;
  try {
    return await fn();
  } finally {
    current = previous;
  }
}
