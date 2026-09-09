#!/usr/bin/env node
/**
 * Counts hand-written source lines (excluding blank lines) for the submission form.
 * Skips dependencies, build output, lockfiles, generated screenshots and data.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const INCLUDE_EXT = new Set([
  '.ts',
  '.tsx',
  '.css',
  '.mjs',
  '.js',
  '.html',
  '.sql',
  '.md',
  '.yml',
  '.yaml',
  '.json',
]);
const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'coverage',
  '.git',
  'data',
  'screenshots',
  '.vite',
]);
const SKIP_FILES = new Set(['package-lock.json']);

const buckets = new Map();
let totalFiles = 0;
let totalLines = 0;
let testFiles = 0;
let testLines = 0;

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!SKIP_DIRS.has(entry)) walk(full);
      continue;
    }
    if (SKIP_FILES.has(entry)) continue;
    const ext = extname(entry);
    if (!INCLUDE_EXT.has(ext)) continue;
    const text = readFileSync(full, 'utf8');
    const lines = text.split('\n').filter((l) => l.trim().length > 0).length;
    const rel = relative(ROOT, full);
    const top = rel.split('/').slice(0, 2).join('/');
    const bucket = buckets.get(top) ?? { files: 0, lines: 0 };
    bucket.files += 1;
    bucket.lines += lines;
    buckets.set(top, bucket);
    totalFiles += 1;
    totalLines += lines;
    if (/\.test\.[jt]sx?$/.test(entry) || rel.includes('/test/')) {
      testFiles += 1;
      testLines += lines;
    }
  }
}

walk(ROOT);

const rows = [...buckets.entries()].sort((a, b) => b[1].lines - a[1].lines);
const width = Math.max(...rows.map(([k]) => k.length), 10);
console.log(`${'Area'.padEnd(width)}  ${'Files'.padStart(6)}  ${'Lines'.padStart(8)}`);
console.log('-'.repeat(width + 18));
for (const [key, b] of rows) {
  console.log(
    `${key.padEnd(width)}  ${String(b.files).padStart(6)}  ${String(b.lines).padStart(8)}`,
  );
}
console.log('-'.repeat(width + 18));
console.log(
  `${'Total'.padEnd(width)}  ${String(totalFiles).padStart(6)}  ${String(totalLines).padStart(8)}`,
);
console.log(
  `${'  of which tests'.padEnd(width)}  ${String(testFiles).padStart(6)}  ${String(testLines).padStart(8)}`,
);
console.log('\nCounted non-blank lines in .ts/.tsx/.css/.js/.mjs/.html/.sql/.md/.yml/.json files,');
console.log('excluding node_modules, dist, coverage, data, screenshots and package-lock.json.');
