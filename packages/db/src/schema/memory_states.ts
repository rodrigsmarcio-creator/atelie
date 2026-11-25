import { sql } from 'drizzle-orm';
import { check, index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { items } from './items';

// Cache do escalonador por item (docs/04-dados.md): o estado do Card do
// ts-fsrs 5.4 (D-062), um para um com items. Reconstruível por
// `memory:rebuild`; coluna nova aqui exige atualizar o rebuild no mesmo commit.
// Nunca guardar recuperabilidade: o FSRS calcula pelo tempo decorrido.
// O elapsed_days do Card também não entra: é derivado e sai na versão 6.
export const memoryStates = sqliteTable(
  'memory_states',
  {
    itemId: text('item_id')
      .primaryKey()
      .references(() => items.id, { onDelete: 'cascade' }),
    dueAt: text('due_at'),
    stability: real('stability'),
    difficulty: real('difficulty'),
    scheduledDays: integer('scheduled_days').notNull().default(0),
    // Passo da aprendizagem curta, gerido pelo próprio FSRS (não é intervalo
    // fixo nosso; D-023 continua valendo).
    learningSteps: integer('learning_steps').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    // State do ts-fsrs: 0 New, 1 Learning, 2 Review, 3 Relearning.
    state: integer('state').notNull().default(0),
    lastReviewAt: text('last_review_at'),
    // 'fsrs-<versão>' do algoritmo em uso.
    algoVersion: text('algo_version').notNull(),
    ...timestamps(),
  },
  (t) => [
    index('memory_states_due_at_idx').on(t.dueAt),
    check('memory_states_state_enum', sql`state IN (0,1,2,3)`),
    check('memory_states_scheduled_days_min', sql`scheduled_days >= 0`),
    check('memory_states_learning_steps_min', sql`learning_steps >= 0`),
    check('memory_states_reps_min', sql`reps >= 0`),
    check('memory_states_lapses_min', sql`lapses >= 0`),
  ],
);
