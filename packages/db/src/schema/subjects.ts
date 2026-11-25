import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { programs } from './programs';

// Matérias (docs/04-dados.md). `program_id` nulo é matéria avulsa, sem curso
// (D-046); curso com matéria não pode ser apagado (RESTRICT).
export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    programId: text('program_id').references(() => programs.id, { onDelete: 'restrict' }),
    shortName: text('short_name'),
    color: text('color').notNull(),
    icon: text('icon').notNull(),
    weight: integer('weight').notNull().default(0),
    examAt: text('exam_at'),
    archivedAt: text('archived_at'),
    ...timestamps(),
  },
  () => [
    check('subjects_color_hex', sql`length(color) = 7`),
    check('subjects_weight_range', sql`weight BETWEEN 0 AND 100`),
  ],
);
