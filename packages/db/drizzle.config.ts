import { defineConfig } from 'drizzle-kit';

// Só para gerar as migrations a partir do schema (`pnpm --filter @atelie/db
// db:generate`). Quem aplica é o `pnpm db:migrate` (src/migrate.ts), pelo
// mesmo @libsql/client do app, sem o driver do drizzle-kit (D-064).
export default defineConfig({
  dialect: 'sqlite',
  schema: './src/schema/index.ts',
  out: './drizzle',
});
