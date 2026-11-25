import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { skills } from './skills';

// Rubrica do item de explicação (D-057): o que vale nota 2 em cada critério.
export type Rubric = {
  correcao: string;
  justificativa: string;
  coerencia: string;
  aplicacao: string;
  limitacoes: string;
};

// Questões e cartões (docs/04-dados.md). Os campos das provas (D-057) só
// existem na dimensão que os usa; os CHECKs cruzados recusam a combinação
// errada. COALESCE trata `dimension` nula como exercício geral.
export const items = sqliteTable(
  'items',
  {
    id: text('id').primaryKey(),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['multipla_escolha', 'cartao', 'aberta'] }).notNull(),
    prompt: text('prompt').notNull(),
    optionsJson: text('options_json', { mode: 'json' }).$type<string[]>(),
    answer: text('answer').notNull(),
    explanation: text('explanation').notNull(),
    difficulty: integer('difficulty'),
    dimension: text('dimension', {
      enum: ['conceitual', 'fluencia', 'problemas', 'explicacao'],
    }),
    evidence: text('evidence', {
      enum: ['reconhecimento', 'interpretacao', 'representacao', 'discriminacao'],
    }),
    category: text('category', { enum: ['rotineira', 'nao_rotineira', 'transferencia'] }),
    expectedSeconds: integer('expected_seconds'),
    followup: text('followup'),
    rubricJson: text('rubric_json', { mode: 'json' }).$type<Rubric>(),
    origin: text('origin', { enum: ['manual', 'ia', 'import'] }).notNull(),
    reviewedByUser: integer('reviewed_by_user', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
    // A FK para materials entra no ATL-71, quando materials.ts existir.
    sourceMaterialId: text('source_material_id'),
    sourcePage: integer('source_page'),
    archivedAt: text('archived_at'),
    ...timestamps(),
  },
  (t) => [
    index('items_skill_id_idx').on(t.skillId),
    check('items_kind_enum', sql`kind IN ('multipla_escolha','cartao','aberta')`),
    // 4 alternativas: obrigatórias em ME, opcionais no cartão, nulas na aberta.
    check(
      'items_options_json_shape',
      sql`options_json IS NULL OR (json_valid(options_json) AND json_array_length(options_json) = 4)`,
    ),
    check(
      'items_options_json_by_kind',
      sql`(kind = 'multipla_escolha' AND options_json IS NOT NULL) OR kind = 'cartao' OR (kind = 'aberta' AND options_json IS NULL)`,
    ),
    check('items_explanation_min', sql`length(explanation) >= 20`),
    check('items_difficulty_range', sql`difficulty IS NULL OR difficulty BETWEEN 1 AND 3`),
    check(
      'items_dimension_enum',
      sql`dimension IS NULL OR dimension IN ('conceitual','fluencia','problemas','explicacao')`,
    ),
    // Cartão nunca conquista prova (D-037), então nunca tem dimensão.
    check('items_dimension_not_cartao', sql`kind <> 'cartao' OR dimension IS NULL`),
    check(
      'items_evidence_enum',
      sql`evidence IS NULL OR evidence IN ('reconhecimento','interpretacao','representacao','discriminacao')`,
    ),
    check(
      'items_evidence_iff_conceitual',
      sql`(evidence IS NOT NULL) = (COALESCE(dimension, '') = 'conceitual')`,
    ),
    check(
      'items_interpretacao_only_me',
      sql`COALESCE(evidence, '') <> 'interpretacao' OR kind = 'multipla_escolha'`,
    ),
    check(
      'items_category_enum',
      sql`category IS NULL OR category IN ('rotineira','nao_rotineira','transferencia')`,
    ),
    check(
      'items_category_iff_problemas',
      sql`(category IS NOT NULL) = (COALESCE(dimension, '') = 'problemas')`,
    ),
    check(
      'items_expected_seconds_fluencia',
      sql`expected_seconds IS NULL OR (COALESCE(dimension, '') = 'fluencia' AND expected_seconds BETWEEN 1 AND 3600)`,
    ),
    check(
      'items_followup_iff_explicacao',
      sql`(followup IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao')`,
    ),
    check(
      'items_rubric_iff_explicacao',
      sql`(rubric_json IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao')`,
    ),
    check('items_rubric_json_valid', sql`rubric_json IS NULL OR json_valid(rubric_json)`),
    check(
      'items_explicacao_only_aberta',
      sql`COALESCE(dimension, '') <> 'explicacao' OR kind = 'aberta'`,
    ),
    check('items_origin_enum', sql`origin IN ('manual','ia','import')`),
    check('items_reviewed_by_user_bool', sql`reviewed_by_user IN (0,1)`),
  ],
);
