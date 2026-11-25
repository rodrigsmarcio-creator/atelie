import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';

// Matérias (docs/04-dados.md). `program_id` entra no ATL-135.
export const subjects = sqliteTable(
  'subjects',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
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
