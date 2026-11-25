import { sql } from 'drizzle-orm';
import { check, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { subjects } from './subjects';

// Dimensões que podem ser marcadas "não se aplica" (D-043, D-057). A lista é
// validada pelo Zod na importação e na API: o SQLite não confere os valores
// de uma lista num CHECK.
export type NotApplicableDimension = 'fluencia' | 'problemas' | 'explicacao';

// Ofícios, os nós da Árvore (docs/04-dados.md). As colunas `study_*` entram
// no ATL-135.
export const skills = sqliteTable(
  'skills',
  {
    id: text('id').primaryKey(),
    subjectId: text('subject_id')
      .notNull()
      .references(() => subjects.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    label: text('label'),
    description: text('description'),
    icon: text('icon').notNull(),
    depth: integer('depth').notNull(),
    lane: real('lane').notNull().default(0),
    estimatedMinutes: integer('estimated_minutes').notNull(),
    origin: text('origin', { enum: ['manual', 'ia', 'import'] }).notNull(),
    reviewedByUser: integer('reviewed_by_user', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
    // A FK para materials entra no ATL-71, quando materials.ts existir.
    sourceMaterialId: text('source_material_id'),
    notApplicableJson: text('not_applicable_json', { mode: 'json' })
      .$type<NotApplicableDimension[]>()
      .notNull()
      .default(sql`'[]'`),
    ...timestamps(),
  },
  (t) => [
    unique('skills_subject_name').on(t.subjectId, t.name),
    check('skills_depth_min', sql`depth >= 1`),
    check('skills_lane_range', sql`lane BETWEEN -1 AND 1`),
    check('skills_estimated_minutes_range', sql`estimated_minutes BETWEEN 10 AND 40`),
    check('skills_origin_enum', sql`origin IN ('manual','ia','import')`),
    check('skills_reviewed_by_user_bool', sql`reviewed_by_user IN (0,1)`),
    check('skills_not_applicable_json_valid', sql`json_valid(not_applicable_json)`),
  ],
);
