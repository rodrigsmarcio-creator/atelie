import { sql } from 'drizzle-orm';
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// O que o Gregor decidiu (docs/04-dados.md, docs/03-gregor.md seção 5): uma
// linha por DaySession gerada. Planos antigos não são apagados: são o
// histórico de "o que o sistema mandou". `generated_at` faz o papel de
// created_at, como `earned_at` em proofs (D-062), e o plano não se altera.
export const plans = sqliteTable(
  'plans',
  {
    id: text('id').primaryKey(),
    generatedAt: text('generated_at').notNull(),
    mode: text('mode', { enum: ['completa', 'curta'] }).notNull(),
    // Cópia dos params usados, para reproduzir a decisão.
    paramsJson: text('params_json', { mode: 'json' })
      .$type<Record<string, number | boolean | string>>()
      .notNull(),
    // Hash do StateSnapshot de entrada.
    stateHash: text('state_hash').notNull(),
  },
  () => [
    check('plans_mode_enum', sql`mode IN ('completa','curta')`),
    check('plans_params_json_valid', sql`json_valid(params_json)`),
  ],
);
