import { sql } from 'drizzle-orm';
import { check, integer, real, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { materials } from './materials';
import { subjects } from './subjects';

// Dimensões que podem ser marcadas "não se aplica" (D-043, D-057). A lista é
// validada pelo Zod na importação e na API: o SQLite não confere os valores
// de uma lista num CHECK.
export type NotApplicableDimension = 'fluencia' | 'problemas' | 'explicacao';

// Texto de estudo (D-052, D-056): lido na fase Aprender sem gravar tentativa.
// As recomendações apontam para materials pelo id, resolvido na importação a
// partir do nome do arquivo ou do link; não há FK porque ficam dentro do JSON.
export type StudyRecommendation = {
  material_id: string;
  page_from?: number;
  page_to?: number;
  note?: string;
};

export type StudyFaqEntry = { question: string; answer: string };

// Ofícios, os nós da Árvore (docs/04-dados.md).
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
    // Fonte informativa: apagar o material não apaga o Ofício (D-063).
    sourceMaterialId: text('source_material_id').references(() => materials.id, {
      onDelete: 'set null',
    }),
    notApplicableJson: text('not_applicable_json', { mode: 'json' })
      .$type<NotApplicableDimension[]>()
      .notNull()
      .default(sql`'[]'`),
    studyExplanation: text('study_explanation'),
    studyRecommendationsJson: text('study_recommendations_json', {
      mode: 'json',
    }).$type<StudyRecommendation[]>(),
    studyGuidance: text('study_guidance'),
    studyFaqJson: text('study_faq_json', { mode: 'json' }).$type<StudyFaqEntry[]>(),
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
    check(
      'skills_study_recommendations_json_valid',
      sql`study_recommendations_json IS NULL OR json_valid(study_recommendations_json)`,
    ),
    check('skills_study_faq_json_valid', sql`study_faq_json IS NULL OR json_valid(study_faq_json)`),
  ],
);
