import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt } from './columns';
import { reviewLogs } from './review_logs';
import { skills } from './skills';

// Notas da Jane para a Explicação (D-057, D-059), vindas da importação.
// Append-only como review_logs: para reavaliar, o Márcio faz outra tentativa.
// Se as notas aprovam é conta do Gregor, não fica aqui.
export const explanationGrades = sqliteTable(
  'explanation_grades',
  {
    // ULID vindo do arquivo de notas da Jane (idempotência).
    id: text('id').primaryKey(),
    reviewLogId: text('review_log_id')
      .notNull()
      .unique()
      .references(() => reviewLogs.id, { onDelete: 'restrict' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    correcao: integer('correcao').notNull(),
    justificativa: integer('justificativa').notNull(),
    coerencia: integer('coerencia').notNull(),
    aplicacao: integer('aplicacao').notNull(),
    limitacoes: integer('limitacoes').notNull(),
    feedback: text('feedback'),
    gradedAt: text('graded_at').notNull(),
    // A FK para imports entra no ATL-71, quando imports.ts existir.
    importId: text('import_id').notNull(),
    createdAt: createdAt(),
  },
  () => [
    check('explanation_grades_correcao_range', sql`correcao BETWEEN 0 AND 2`),
    check('explanation_grades_justificativa_range', sql`justificativa BETWEEN 0 AND 2`),
    check('explanation_grades_coerencia_range', sql`coerencia BETWEEN 0 AND 2`),
    check('explanation_grades_aplicacao_range', sql`aplicacao BETWEEN 0 AND 2`),
    check('explanation_grades_limitacoes_range', sql`limitacoes BETWEEN 0 AND 2`),
  ],
);
