import { getTableName } from 'drizzle-orm';
import { getTableConfig, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { expect, test } from 'vitest';
import { items, skillPrereqs, skills, subjects } from './index';

// As FKs e o ON DELETE de cada uma, como em docs/04-dados.md. As regras CHECK
// são testadas contra o banco depois da migration 0000 (ATL-72).
function foreignKeys(table: SQLiteTable) {
  return getTableConfig(table).foreignKeys.map((fk) => {
    const ref = fk.reference();
    return {
      columns: ref.columns.map((c) => c.name),
      target: `${getTableName(ref.foreignTable)}(${ref.foreignColumns.map((c) => c.name).join()})`,
      onDelete: fk.onDelete,
    };
  });
}

test('skills aponta para subjects com ON DELETE RESTRICT', () => {
  expect(foreignKeys(skills)).toEqual([
    { columns: ['subject_id'], target: 'subjects(id)', onDelete: 'restrict' },
  ]);
});

test('skill_prereqs aponta duas vezes para skills com ON DELETE CASCADE', () => {
  expect(foreignKeys(skillPrereqs)).toEqual([
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
    { columns: ['prereq_id'], target: 'skills(id)', onDelete: 'cascade' },
  ]);
});

test('items aponta para skills com ON DELETE CASCADE', () => {
  expect(foreignKeys(items)).toEqual([
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
  ]);
});

test('source_material_id ainda não tem FK (entra no ATL-71)', () => {
  for (const table of [skills, items]) {
    const columns = foreignKeys(table).flatMap((fk) => fk.columns);
    expect(columns).not.toContain('source_material_id');
  }
});

test('created_at e updated_at nascem em ISO 8601 UTC', () => {
  for (const table of [subjects, skills, skillPrereqs, items]) {
    for (const column of getTableConfig(table).columns) {
      if (column.name !== 'created_at' && column.name !== 'updated_at') continue;
      expect(column.notNull).toBe(true);
      expect(column.defaultFn?.()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  }
});

test('updated_at se renova a cada alteração', () => {
  for (const table of [subjects, skills, items]) {
    const updatedAt = getTableConfig(table).columns.find((c) => c.name === 'updated_at');
    expect(updatedAt?.onUpdateFn?.()).toMatch(/Z$/);
  }
});
