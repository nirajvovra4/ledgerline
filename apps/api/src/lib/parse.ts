import { formatIssues } from '@ledgerline/shared';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../errors';

/** Validate `data` against a shared Zod schema, throwing the API's 400 error on failure. */
export function parse<S extends ZodTypeAny>(
  schema: S,
  data: unknown,
  message = 'Please check the form',
): z.infer<S> {
  const result = schema.safeParse(data ?? {});
  if (!result.success) {
    throw new AppError('validation_error', message, formatIssues(result.error));
  }
  return result.data;
}

/** Parse JSON stored in a text column, falling back to `fallback` for corrupt/empty values. */
export function parseJson<T>(text: string | null | undefined, fallback: T): T {
  if (!text) return fallback;
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}
