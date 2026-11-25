import { getTableName } from 'drizzle-orm';
import { getTableConfig, SQLiteSyncDialect, type SQLiteTable } from 'drizzle-orm/sqlite-core';
import { expect, test } from 'vitest';
import {
  explanationGrades,
  items,
  materials,
  materialSkills,
  memoryStates,
  programs,
  proofs,
  reviewLogs,
  skillPrereqs,
  skills,
  subjects,
} from './index';

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

test('skills aponta para subjects (RESTRICT) e para materials (SET NULL)', () => {
  expect(foreignKeys(skills)).toEqual([
    { columns: ['subject_id'], target: 'subjects(id)', onDelete: 'restrict' },
    { columns: ['source_material_id'], target: 'materials(id)', onDelete: 'set null' },
  ]);
});

test('skill_prereqs aponta duas vezes para skills com ON DELETE CASCADE', () => {
  expect(foreignKeys(skillPrereqs)).toEqual([
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
    { columns: ['prereq_id'], target: 'skills(id)', onDelete: 'cascade' },
  ]);
});

test('items aponta para skills (CASCADE) e para materials (SET NULL)', () => {
  expect(foreignKeys(items)).toEqual([
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
    { columns: ['source_material_id'], target: 'materials(id)', onDelete: 'set null' },
  ]);
});

test('materials tem path e url únicos, ambos opcionais', () => {
  for (const name of ['path', 'url']) {
    expect(column(materials, name).isUnique).toBe(true);
    expect(column(materials, name).notNull).toBe(false);
  }
  expect(foreignKeys(materials)).toEqual([]);
});

test('materials amarra path, url e body ao tipo (D-063)', () => {
  expect(checks(materials)).toEqual({
    materials_kind_enum: "kind IN ('pdf','video','link','nota','livro','markdown')",
    materials_path_by_kind: "(path IS NOT NULL) = (kind IN ('pdf','markdown'))",
    materials_url_by_kind: "(url IS NOT NULL) = (kind IN ('video','link'))",
    materials_body_by_kind: "body IS NULL OR kind IN ('nota','markdown')",
    materials_body_required_nota: "kind <> 'nota' OR body IS NOT NULL",
    materials_pages_min: 'pages IS NULL OR pages >= 1',
    materials_progress_range: 'progress BETWEEN 0 AND 1',
    materials_meta_json_valid: 'meta_json IS NULL OR json_valid(meta_json)',
  });
});

test('material_skills liga material e Ofício, com CASCADE nos dois lados', () => {
  expect(foreignKeys(materialSkills)).toEqual([
    { columns: ['material_id'], target: 'materials(id)', onDelete: 'cascade' },
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
  ]);
  const pk = getTableConfig(materialSkills).primaryKeys[0];
  expect(pk?.columns.map((c) => c.name)).toEqual(['material_id', 'skill_id']);
  expect(checks(materialSkills)).toEqual({
    material_skills_page_from_min: 'page_from IS NULL OR page_from >= 1',
    material_skills_page_to_min: 'page_to IS NULL OR page_to >= 1',
    material_skills_page_order: 'page_from IS NULL OR page_to IS NULL OR page_from <= page_to',
  });
});

function columnNames(table: SQLiteTable) {
  return getTableConfig(table).columns.map((c) => c.name);
}

function indexes(table: SQLiteTable) {
  return getTableConfig(table).indexes.map((i) => ({
    name: i.config.name,
    columns: i.config.columns.map((c) => ('name' in c ? c.name : '?')),
  }));
}

test('review_logs aponta para items e skills com ON DELETE RESTRICT', () => {
  expect(foreignKeys(reviewLogs)).toEqual([
    { columns: ['item_id'], target: 'items(id)', onDelete: 'restrict' },
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'restrict' },
  ]);
});

test('review_logs é append-only: sem updated_at', () => {
  expect(columnNames(reviewLogs)).toContain('created_at');
  expect(columnNames(reviewLogs)).not.toContain('updated_at');
});

test('review_logs tem os índices do histórico do item e do Ofício', () => {
  expect(indexes(reviewLogs)).toEqual([
    { name: 'review_logs_item_reviewed_idx', columns: ['item_id', 'reviewed_at'] },
    { name: 'review_logs_skill_reviewed_idx', columns: ['skill_id', 'reviewed_at'] },
  ]);
});

test('review_logs tem os CHECKs de mode, booleanos, grade e attempt', () => {
  expect(checks(reviewLogs)).toMatchObject({
    review_logs_mode_enum: "mode IN ('prova','retoque','sessao','simulado')",
    review_logs_correct_bool: 'correct IN (0,1)',
    review_logs_grade_range: 'grade IS NULL OR grade BETWEEN 1 AND 4',
    review_logs_attempt_range: 'attempt IS NULL OR attempt BETWEEN 1 AND 3',
    review_logs_viewed_solution_bool: 'viewed_solution IN (0,1)',
    review_logs_timed_bool: 'timed IN (0,1)',
    review_logs_answer_ms_min: 'answer_ms >= 0',
  });
});

test('explanation_grades: uma nota por tentativa, FKs com ON DELETE RESTRICT', () => {
  expect(foreignKeys(explanationGrades)).toEqual([
    { columns: ['review_log_id'], target: 'review_logs(id)', onDelete: 'restrict' },
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'restrict' },
  ]);
  expect(column(explanationGrades, 'review_log_id').isUnique).toBe(true);
  expect(columnNames(explanationGrades)).not.toContain('updated_at');
});

test('explanation_grades.import_id é obrigatório, mas a FK só entra no ATL-71', () => {
  expect(column(explanationGrades, 'import_id').notNull).toBe(true);
  const columns = foreignKeys(explanationGrades).flatMap((fk) => fk.columns);
  expect(columns).not.toContain('import_id');
});

test('explanation_grades tem as 5 notas de 0 a 2', () => {
  const all = checks(explanationGrades);
  for (const name of ['correcao', 'justificativa', 'coerencia', 'aplicacao', 'limitacoes']) {
    expect(column(explanationGrades, name).notNull).toBe(true);
    expect(all[`explanation_grades_${name}_range`]).toBe(`${name} BETWEEN 0 AND 2`);
  }
});

test('proofs: uma prova por dimensão, a tentativa que a completou é obrigatória', () => {
  expect(foreignKeys(proofs)).toEqual([
    { columns: ['skill_id'], target: 'skills(id)', onDelete: 'cascade' },
    { columns: ['review_log_id'], target: 'review_logs(id)', onDelete: 'restrict' },
  ]);
  const pk = getTableConfig(proofs).primaryKeys[0];
  expect(pk?.columns.map((c) => c.name)).toEqual(['skill_id', 'kind']);
  expect(column(proofs, 'review_log_id').notNull).toBe(true);
  expect(checks(proofs)).toEqual({
    proofs_kind_enum: "kind IN ('conceitual','fluencia','problemas','autonomia','explicacao')",
  });
});

test('memory_states é o cache do FSRS por item, com índice em due_at', () => {
  expect(foreignKeys(memoryStates)).toEqual([
    { columns: ['item_id'], target: 'items(id)', onDelete: 'cascade' },
  ]);
  expect(column(memoryStates, 'algo_version').notNull).toBe(true);
  expect(indexes(memoryStates)).toEqual([
    { name: 'memory_states_due_at_idx', columns: ['due_at'] },
  ]);
});

test('memory_states guarda o estado do Card do ts-fsrs 5, sem recuperabilidade', () => {
  expect(columnNames(memoryStates)).toEqual(
    expect.arrayContaining([
      'due_at',
      'stability',
      'difficulty',
      'scheduled_days',
      'learning_steps',
      'reps',
      'lapses',
      'state',
      'last_review_at',
    ]),
  );
  expect(columnNames(memoryStates).some((n) => n.includes('retriev'))).toBe(false);
  expect(checks(memoryStates)).toMatchObject({ memory_states_state_enum: 'state IN (0,1,2,3)' });
});

test('created_at e updated_at nascem em ISO 8601 UTC', () => {
  for (const table of [
    programs,
    subjects,
    skills,
    skillPrereqs,
    items,
    reviewLogs,
    explanationGrades,
    memoryStates,
    materials,
    materialSkills,
  ]) {
    for (const column of getTableConfig(table).columns) {
      if (column.name !== 'created_at' && column.name !== 'updated_at') continue;
      expect(column.notNull).toBe(true);
      expect(column.defaultFn?.()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    }
  }
});

test('updated_at se renova a cada alteração', () => {
  for (const table of [programs, subjects, skills, items, memoryStates, materials]) {
    const updatedAt = getTableConfig(table).columns.find((c) => c.name === 'updated_at');
    expect(updatedAt?.onUpdateFn?.()).toMatch(/Z$/);
  }
});
