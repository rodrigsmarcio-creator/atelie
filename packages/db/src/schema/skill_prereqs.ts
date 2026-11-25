import { sql } from 'drizzle-orm';
import { check, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt } from './columns';
import { skills } from './skills';

// Arestas do grafo de pré-requisitos (docs/04-dados.md). A aciclicidade é
// validada na importação e na API; o banco não consegue garantir.
export const skillPrereqs = sqliteTable(
  'skill_prereqs',
  {
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    prereqId: text('prereq_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.skillId, t.prereqId] }),
    check('skill_prereqs_not_self', sql`skill_id <> prereq_id`),
  ],
);
