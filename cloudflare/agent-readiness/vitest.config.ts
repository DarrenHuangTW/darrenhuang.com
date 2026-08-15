import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    hookTimeout: 30_000,
    include: ['cloudflare/agent-readiness/src/**/*.test.ts'],
    testTimeout: 15_000,
  },
});
