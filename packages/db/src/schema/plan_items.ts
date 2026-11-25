import { sql } from 'drizzle-orm';
import { check, index, integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';
import { plans } from './plans';
import { skills } from './skills';

// Uma linha por SessionItem do plano (docs/03-gregor.md seção 5). Bloco pulado
// também vira linha, sem Ofício, com `skipped = 1` e o motivo, para ficar no
// histórico (D-063). `scheduled_start` e `google_event_id` são preenchidos
// pelo Planejar quando cria o evento; afinados no ticket dele (A-007).
export const planItems = sqliteTable(
  'plan_items',
  {
    id: text('id').primaryKey(),
    planId: text('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    block: integer('block').notNull(),
    position: integer('position').notNull(),
    kind: text('kind', {
      enum: ['revisao_previa', 'materia_nova', 'reforco', 'cartoes'],
    }).notNull(),
    // Histórico: o Ofício não some enquanto houver plano que o citou (D-062).
    skillId: text('skill_id').references(() => skills.id, { onDelete: 'restrict' }),
    // Vazio no bloco de matéria nova e no bloco pulado.
    itemIdsJson: text('item_ids_json', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
    minutes: integer('minutes').notNull(),
    skipped: integer('skipped', { mode: 'boolean' })
      .notNull()
      .default(sql`0`),
    // Sempre preenchido, inclusive quando pulado.
    reasonJson: text('reason_json', { mode: 'json' }).$type<string[]>().notNull(),
    breakdownJson: text('breakdown_json', { mode: 'json' }).$type<Record<string, number>>(),
    scheduledStart: text('scheduled_start'),
    googleEventId: text('google_event_id'),
    doneAt: text('done_at'),
    ...timestamps(),
  },
  (t) => [
    index('plan_items_plan_scheduled_idx').on(t.planId, t.scheduledStart),
    unique('plan_items_plan_block_position').on(t.planId, t.block, t.position),
    check('plan_items_block_range', sql`block BETWEEN 1 AND 4`),
    check(
      'plan_items_kind_enum',
      sql`kind IN ('revisao_previa','materia_nova','reforco','cartoes')`,
    ),
    // A ordem dos blocos é fixa (D-024): o tipo acompanha o número.
    check(
      'plan_items_kind_by_block',
      sql`kind = CASE block WHEN 1 THEN 'revisao_previa' WHEN 2 THEN 'materia_nova' WHEN 3 THEN 'reforco' WHEN 4 THEN 'cartoes' END`,
    ),
    check('plan_items_position_min', sql`position >= 0`),
    check('plan_items_minutes_min', sql`minutes >= 0`),
    check('plan_items_skipped_bool', sql`skipped IN (0,1)`),
    check('plan_items_skill_iff_not_skipped', sql`(skill_id IS NULL) = (skipped = 1)`),
    check('plan_items_item_ids_json_valid', sql`json_valid(item_ids_json)`),
    check('plan_items_reason_json_valid', sql`json_valid(reason_json)`),
    check(
      'plan_items_breakdown_json_valid',
      sql`breakdown_json IS NULL OR json_valid(breakdown_json)`,
    ),
  ],
);
