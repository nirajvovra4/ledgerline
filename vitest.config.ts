import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/shared', 'apps/api', 'apps/web'],
    coverage: {
      provider: 'v8',
      include: ['packages/shared/src/**', 'apps/api/src/**', 'apps/web/src/**'],
      exclude: ['**/*.test.*', '**/test/**', 'apps/web/src/main.tsx'],
      reporter: ['text', 'html'],
    },
  },
});
