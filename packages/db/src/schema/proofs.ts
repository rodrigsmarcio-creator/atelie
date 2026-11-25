import { sql } from 'drizzle-orm';
import { check, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { reviewLogs } from './review_logs';
import { skills } from './skills';

// Provas conquistadas por Ofício (docs/04-dados.md), uma por dimensão (D-022).
// Cache materializado: `memory:rebuild` reconstrói a partir de review_logs e
// explanation_grades. earned_at faz o papel de created_at.
export const proofs = sqliteTable(
  'proofs',
  {
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['conceitual', 'fluencia', 'problemas', 'autonomia', 'explicacao'],
    }).notNull(),
    // A tentativa que completou o critério; na Explicação, a tentativa avaliada.
    // Toda prova nasce de uma tentativa, por isso NOT NULL (D-062).
    reviewLogId: text('review_log_id')
      .notNull()
      .references(() => reviewLogs.id, { onDelete: 'restrict' }),
    earnedAt: text('earned_at').notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.skillId, t.kind] }),
    check(
      'proofs_kind_enum',
      sql`kind IN ('conceitual','fluencia','problemas','autonomia','explicacao')`,
    ),
  ],
);
