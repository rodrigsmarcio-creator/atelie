import { defineConfig } from 'vitest/config';

// Um projeto por pacote, todos rodados pela raiz (um só coverage/lcov.info).
export default defineConfig({
  test: {
    projects: [
      { test: { name: 'core', root: './packages/core', environment: 'node' } },
      { test: { name: 'db', root: './packages/db', environment: 'node' } },
      { test: { name: 'web', root: './apps/web', environment: 'node' } },
    ],
    coverage: {
      enabled: true,
      provider: 'v8',
      // lcov é o que o SonarCloud vai ler (ATL-19); text aparece no terminal.
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      // Lista os arquivos mesmo sem teste, para a cobertura não "sumir" com código novo.
      include: ['packages/*/src/**/*.{ts,tsx}', 'apps/web/app/**/*.{ts,tsx}'],
      exclude: ['**/*.test.{ts,tsx}'],
      // Limites por pasta (D-031): hipótese inicial, ajustar com o código real.
      // apps/web fica sem mínimo por enquanto.
      thresholds: {
        'packages/core/**': { statements: 90, branches: 90, functions: 90, lines: 90 },
        'packages/db/**': { statements: 60, branches: 60, functions: 60, lines: 60 },
      },
    },
  },
});
