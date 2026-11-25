import { sql } from 'drizzle-orm';
import { check, integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAt } from './columns';
import { materials } from './materials';
import { skills } from './skills';

// Ligação material ↔ Ofício (docs/04-dados.md): um livro serve a vários
// Ofícios, por capítulo. As páginas vêm do `source` do Ofício na importação
// (D-056). Arquivo separado de materials.ts porque skills.ts importa materials.
export const materialSkills = sqliteTable(
  'material_skills',
  {
    materialId: text('material_id')
      .notNull()
      .references(() => materials.id, { onDelete: 'cascade' }),
    skillId: text('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    pageFrom: integer('page_from'),
    pageTo: integer('page_to'),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.materialId, t.skillId] }),
    check('material_skills_page_from_min', sql`page_from IS NULL OR page_from >= 1`),
    check('material_skills_page_to_min', sql`page_to IS NULL OR page_to >= 1`),
    check(
      'material_skills_page_order',
      sql`page_from IS NULL OR page_to IS NULL OR page_from <= page_to`,
    ),
  ],
);
