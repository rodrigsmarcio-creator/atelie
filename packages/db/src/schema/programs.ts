import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';

// Cursos, o nível acima da matéria (docs/04-dados.md, D-046). Só no backend:
// sem tela no MVP. `reference` é texto livre de propósito (D-056).
export const programs = sqliteTable('programs', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  reference: text('reference').notNull(),
  archivedAt: text('archived_at'),
  ...timestamps(),
});
