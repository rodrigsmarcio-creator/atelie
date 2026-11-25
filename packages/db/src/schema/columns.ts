import { text } from 'drizzle-orm/sqlite-core';

// Datas em ISO 8601 UTC (docs/04-dados.md). Preenchidas pela aplicação quando o
// código não passa valor; o DEFAULT CURRENT_TIMESTAMP do SQLite não serve
// porque não grava no formato ISO com "Z".
const nowIso = () => new Date().toISOString();

export const createdAt = () => text('created_at').notNull().$defaultFn(nowIso);

export const timestamps = () => ({
  createdAt: createdAt(),
  updatedAt: text('updated_at').notNull().$defaultFn(nowIso).$onUpdateFn(nowIso),
});
