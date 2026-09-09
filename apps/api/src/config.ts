import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isIsoDate } from '@ledgerline/shared';

/** Absolute path of the monorepo root (two levels above `apps/api`). */
export function repoRoot(): string {
  // Works both from `src/config.ts` (tsx) and from the bundled `dist/server.js`.
  const here = fileURLToPath(import.meta.url);
  const marker = '/apps/api/';
  const idx = here.lastIndexOf(marker);
  if (idx >= 0) return here.slice(0, idx);
  return resolve(process.cwd());
}

export interface Config {
  port: number;
  host: string;
  databasePath: string;
  /** Fixed business date, e.g. `2026-06-30`, or null for the real clock. */
  today: string | null;
  sessionSecret: string;
  staticDir: string | null;
  nodeEnv: string;
  seedIfEmpty: boolean;
}

/** Read configuration from the environment, applying the documented defaults. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const root = repoRoot();
  const today = env.LEDGERLINE_TODAY?.trim() || null;
  if (today && !isIsoDate(today)) {
    throw new Error(`LEDGERLINE_TODAY must be a YYYY-MM-DD date, received "${today}"`);
  }
  const databasePath = resolve(root, env.DATABASE_PATH?.trim() || './data/ledgerline.sqlite');
  const defaultStatic = resolve(root, 'apps/web/dist');
  const staticDir = env.STATIC_DIR?.trim()
    ? resolve(root, env.STATIC_DIR.trim())
    : existsSync(defaultStatic)
      ? defaultStatic
      : null;
  return {
    port: Number(env.PORT ?? 4000) || 4000,
    host: env.HOST?.trim() || '0.0.0.0',
    databasePath,
    today,
    sessionSecret: env.SESSION_SECRET?.trim() || 'ledgerline-dev-secret-change-me',
    staticDir,
    nodeEnv: env.NODE_ENV?.trim() || 'development',
    seedIfEmpty: (env.SEED_IF_EMPTY ?? '').toLowerCase() === 'true',
  };
}
