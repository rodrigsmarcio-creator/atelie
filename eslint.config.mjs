import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

// Regra de dependência do docs/01-arquitetura.md: web → db → core.
const forbidImports = (packages, message) => ({
  'no-restricted-imports': [
    'error',
    { patterns: [{ group: packages.flatMap((p) => [p, `${p}/*`]), message }] },
  ],
});

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/.next/',
    '**/dist/',
    '**/coverage/',
    '**/next-env.d.ts',
    '_arquivos-originais/',
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  {
    files: ['apps/web/**'],
    extends: [nextVitals],
    settings: { next: { rootDir: 'apps/web' } },
  },
  {
    files: ['packages/core/**'],
    rules: forbidImports(
      ['@atelie/db', '@atelie/web'],
      'O Gregor (core) não importa ninguém: web → db → core.',
    ),
  },
  {
    files: ['packages/db/**'],
    rules: forbidImports(['@atelie/web'], 'db não importa web: web → db → core.'),
  },
  prettier,
]);
