import type { ZodError, ZodIssue, ZodTypeAny, z } from 'zod';

export interface FieldIssue {
  path: string;
  message: string;
  code: string;
}

export type ValidationResult<T> = { ok: true; data: T } | { ok: false; issues: FieldIssue[] };

export function formatIssues(error: ZodError | { issues: ZodIssue[] }): FieldIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.map(String).join('.'),
    message: issue.message,
    code: issue.code,
  }));
}

export function validate<S extends ZodTypeAny>(schema: S, data: unknown): ValidationResult<z.infer<S>> {
  const result = schema.safeParse(data);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, issues: formatIssues(result.error) };
}

/** Collapse a list of issues into a `{ field: message }` map (first message wins). */
export function issuesByField(issues: FieldIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path || '_';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

export function firstIssueMessage(issues: FieldIssue[], fallback = 'Please check the form.'): string {
  return issues[0]?.message ?? fallback;
}
