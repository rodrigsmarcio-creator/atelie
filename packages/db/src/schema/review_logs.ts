import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt } from './columns';
import { items } from './items';
import { skills } from './skills';

// O registro bruto de cada tentativa (docs/04-dados.md). Append-only: sem
// updated_at, e nenhum código escreve UPDATE ou DELETE nesta tabela. É daqui
// que o Gregor tira domínio, ofensiva e XP, e o FSRS se recalibra.
export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: text('id').primaryKey(),
    // Nunca apagar item ou Ofício com histórico (D-062).
    itemId: text('item_id')
      .notNull()
      .references(() => items.id, { onDelete: 'restrict' }),
    // Desnormalizado de propósito: consulta por Ofício sem join.
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'restrict' }),
    reviewedAt: text('reviewed_at').notNull(),
    mode: text('mode', { enum: ['prova', 'retoque', 'sessao', 'simulado'] }).notNull(),
    correct: integer('correct', { mode: 'boolean' }).notNull(),
    // 1–4 nos cartões (Errei, Difícil, Bom, Fácil); nulo nas questões.
    grade: integer('grade'),
    answerMs: integer('answer_ms').notNull(),
    viewedSolution: integer('viewed_solution', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
    reasoning: text('reasoning'),
    response: text('response'),
    followupAnswer: text('followup_answer'),
    // Cartão de alternativas: tentativas usadas (D-043).
    attempt: integer('attempt'),
    // ULID da rodada de 5 problemas, gerado pelo app (D-057).
    roundId: text('round_id'),
    timed: integer('timed', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
    sessionId: text('session_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('review_logs_item_reviewed_idx').on(t.itemId, t.reviewedAt),
    index('review_logs_skill_reviewed_idx').on(t.skillId, t.reviewedAt),
    check('review_logs_mode_enum', sql`mode IN ('prova','retoque','sessao','simulado')`),
    check('review_logs_correct_bool', sql`correct IN (0,1)`),
    check('review_logs_grade_range', sql`grade IS NULL OR grade BETWEEN 1 AND 4`),
    check('review_logs_answer_ms_min', sql`answer_ms >= 0`),
    check('review_logs_viewed_solution_bool', sql`viewed_solution IN (0,1)`),
    check('review_logs_attempt_range', sql`attempt IS NULL OR attempt BETWEEN 1 AND 3`),
    check('review_logs_timed_bool', sql`timed IN (0,1)`),
  ],
);
