import { getTableName } from 'drizzle-orm';
import { getTableConfig, SQLiteSyncDialect, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { expect, test } from 'vitest';
import { items, programs, skillPrereqs, skills, subjects } from './index';

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

function column(table: SQLiteTable, name: string) {
  const found = getTableConfig(table).columns.find((c) => c.name === name);
  if (found === undefined) throw new Error(`coluna ${name} não existe`);
  return found;
}

// O SQL de cada CHECK, pelo nome.
function checks(table: SQLiteTable) {
  const dialect = new SQLiteSyncDialect();
  return Object.fromEntries(
    getTableConfig(table).checks.map((c) => [c.name, dialect.sqlToQuery(c.value).sql]),
  );
}

test('programs tem name único e reference obrigatória', () => {
  expect(column(programs, 'name').notNull).toBe(true);
  expect(column(programs, 'name').isUnique).toBe(true);
  expect(column(programs, 'reference').notNull).toBe(true);
  expect(column(programs, 'archived_at').notNull).toBe(false);
});

test('subjects aponta para programs com ON DELETE RESTRICT, e program_id aceita nulo', () => {
  expect(foreignKeys(subjects)).toEqual([
    { columns: ['program_id'], target: 'programs(id)', onDelete: 'restrict' },
  ]);
  expect(column(subjects, 'program_id').notNull).toBe(false);
});

test('o texto de estudo de skills é todo opcional', () => {
  for (const name of [
    'study_explanation',
    'study_recommendations_json',
    'study_guidance',
    'study_faq_json',
  ]) {
    expect(column(skills, name).notNull).toBe(false);
  }
});

test('os JSON do texto de estudo têm CHECK de json_valid que aceita nulo', () => {
  expect(checks(skills)).toMatchObject({
    skills_study_recommendations_json_valid:
      'study_recommendations_json IS NULL OR json_valid(study_recommendations_json)',
    skills_study_faq_json_valid: 'study_faq_json IS NULL OR json_valid(study_faq_json)',
  });
});

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
  for (const table of [programs, subjects, skills, skillPrereqs, items]) {
    for (const column of getTableConfig(table).columns) {
      if (column.name !== 'created_at' && column.name !== 'updated_at') continue;
      expect(column.notNull).toBe(true);
      expect(column.defaultFn?.()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  }
});

test('updated_at se renova a cada alteração', () => {
  for (const table of [programs, subjects, skills, items]) {
    const updatedAt = getTableConfig(table).columns.find((c) => c.name === 'updated_at');
    expect(updatedAt?.onUpdateFn?.()).toMatch(/Z$/);
  }
});
