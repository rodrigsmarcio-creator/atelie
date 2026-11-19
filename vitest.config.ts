import { defineConfig } from 'vitest/config';

// Um projeto por pacote, todos rodados pela raiz (um só coverage/lcov.info).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: './packages/core', environment: 'node' } },
      { test: { name: 'db', root: './packages/db', environment: 'node' } },
      { test: { name: 'web', root: './apps/web', environment: 'node' } },
    ],
  },
});
