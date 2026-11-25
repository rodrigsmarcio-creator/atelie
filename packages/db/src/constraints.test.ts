import type { Client } from '@libsql/client';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baseRows, insertRow, openMigratedDb, type Row, type TableName } from './test-db';

// Regras das tabelas conferidas contra o banco da migration 0000 (ATL-72;
// D-057, D-061 a D-063). Cada caso errado quebra uma regra só, e a recusa
// tem de trazer o nome dela: assim se sabe que foi a regra certa que barrou.

let db: Client;

// Todo teste começa com curso, matéria e um Ofício.
beforeEach(async () => {
  db = await openMigratedDb();
  await insertRow(db, 'programs', baseRows.programs);
  await insertRow(db, 'subjects', baseRows.subjects);
  await insertRow(db, 'skills', baseRows.skills);
});

afterEach(() => db.close());

async function count(table: TableName) {
  const { rows } = await db.execute(`SELECT count(*) AS n FROM "${table}"`);
  return Number(rows[0]?.['n']);
}

async function expectCheckRefused(table: TableName, row: Row, rule: string) {
  await expect(insertRow(db, table, row)).rejects.toThrow(`CHECK constraint failed: ${rule}`);
}

const OPTIONS = '["a","b","c","d"]';
const RUBRIC =
  '{"correcao":"c","justificativa":"j","coerencia":"c","aplicacao":"a","limitacoes":"l"}';
const OPEN: Row = { kind: 'aberta', options_json: null };
const EXPLICACAO: Row = {
  ...OPEN,
  dimension: 'explicacao',
  followup: 'Pergunta complementar de teste?',
  rubric_json: RUBRIC,
};

describe('items: marcações das provas (D-057)', () => {
  // A base de items é o exercício geral de múltipla escolha.
  const valid: [string, Row][] = [
    ['ME geral', {}],
    ['cartão dissertativo', { kind: 'cartao', options_json: null }],
    ['cartão de alternativas', { kind: 'cartao', options_json: OPTIONS }],
    ['conceitual com evidência', { ...OPEN, dimension: 'conceitual', evidence: 'reconhecimento' }],
    ['interpretacao em ME', { dimension: 'conceitual', evidence: 'interpretacao' }],
    ['fluência com tempo', { dimension: 'fluencia', expected_seconds: 60 }],
    ['problemas com categoria', { ...OPEN, dimension: 'problemas', category: 'rotineira' }],
    ['explicação aberta com followup e rubrica', EXPLICACAO],
  ];

  test.each(valid)('grava: %s', async (_, change) => {
    await insertRow(db, 'items', { ...baseRows.items, ...change });
    expect(await count('items')).toBe(1);
  });

  const refused: [string, Row, string][] = [
    ['ME sem alternativas', { options_json: null }, 'items_options_json_by_kind'],
    ['aberta com alternativas', { kind: 'aberta' }, 'items_options_json_by_kind'],
    ['3 alternativas', { options_json: '["a","b","c"]' }, 'items_options_json_shape'],
    [
      'cartão com dimensão',
      { kind: 'cartao', dimension: 'fluencia' },
      'items_dimension_not_cartao',
    ],
    ['conceitual sem evidência', { dimension: 'conceitual' }, 'items_evidence_iff_conceitual'],
    ['evidência sem conceitual', { evidence: 'reconhecimento' }, 'items_evidence_iff_conceitual'],
    [
      'interpretacao fora de ME',
      { ...OPEN, dimension: 'conceitual', evidence: 'interpretacao' },
      'items_interpretacao_only_me',
    ],
    ['problemas sem categoria', { dimension: 'problemas' }, 'items_category_iff_problemas'],
    ['tempo fora de fluência', { expected_seconds: 60 }, 'items_expected_seconds_fluencia'],
    [
      'tempo igual a 0',
      { dimension: 'fluencia', expected_seconds: 0 },
      'items_expected_seconds_fluencia',
    ],
    ['explicação sem rubrica', { ...EXPLICACAO, rubric_json: null }, 'items_rubric_iff_explicacao'],
    [
      'explicação fora de aberta',
      { ...EXPLICACAO, kind: 'multipla_escolha', options_json: OPTIONS },
      'items_explicacao_only_aberta',
    ],
    [
      'followup fora de explicação',
      { followup: 'Pergunta complementar de teste?' },
      'items_followup_iff_explicacao',
    ],
  ];

  test.each(refused)('recusa: %s', async (_, change, rule) => {
    await expectCheckRefused('items', { ...baseRows.items, ...change }, rule);
  });
});

describe('items e skills: regras óbvias (D-061)', () => {
  test('explanation curta é recusada', async () => {
    await expectCheckRefused(
      'items',
      { ...baseRows.items, explanation: 'curta' },
      'items_explanation_min',
    );
  });

  test.each([0, 4])('difficulty %i fica fora de 1 a 3', async (difficulty) => {
    await expectCheckRefused('items', { ...baseRows.items, difficulty }, 'items_difficulty_range');
  });

  test('reviewed_by_user só aceita 0 ou 1, no item e no Ofício', async () => {
    await expectCheckRefused(
      'items',
      { ...baseRows.items, reviewed_by_user: 2 },
      'items_reviewed_by_user_bool',
    );
    await expectCheckRefused(
      'skills',
      { ...baseRows.skills, id: 'skill-2', name: 'Segundo Ofício', reviewed_by_user: 2 },
      'skills_reviewed_by_user_bool',
    );
  });

  test('o Ofício não é pré-requisito de si mesmo', async () => {
    await expectCheckRefused(
      'skill_prereqs',
      { skill_id: 'skill-1', prereq_id: 'skill-1', created_at: baseRows.skills.created_at },
      'skill_prereqs_not_self',
    );
  });

  // O banco só confere que é JSON; quais valores entram na lista é o Zod (D-057).
  test('not_applicable_json que não é JSON é recusado', async () => {
    await expectCheckRefused(
      'skills',
      { ...baseRows.skills, id: 'skill-2', name: 'Segundo Ofício', not_applicable_json: 'abc' },
      'skills_not_applicable_json_valid',
    );
  });
});

// O SQLite não diz qual FK barrou, só que uma barrou.
const FK_FAILED = 'FOREIGN KEY constraint failed';

async function remove(table: TableName, id: string) {
  await db.execute({ sql: `DELETE FROM "${table}" WHERE id = ?`, args: [id] });
}

// Item e tentativa da base, para os casos que precisam de histórico.
async function insertItemAndLog() {
  await insertRow(db, 'items', baseRows.items);
  await insertRow(db, 'review_logs', baseRows.review_logs);
}

describe('chaves estrangeiras e provas', () => {
  test('item apontando para Ofício que não existe é recusado', async () => {
    await expect(
      insertRow(db, 'items', { ...baseRows.items, skill_id: 'skill-inexistente' }),
    ).rejects.toThrow(FK_FAILED);
  });

  test('proofs.kind fora das 5 dimensões é recusado', async () => {
    await insertItemAndLog();
    await expectCheckRefused('proofs', { ...baseRows.proofs, kind: 'dominio' }, 'proofs_kind_enum');
  });

  test('uma nota da Jane só por tentativa (D-057)', async () => {
    await insertItemAndLog();
    await insertRow(db, 'imports', baseRows.imports);
    await insertRow(db, 'explanation_grades', baseRows.explanation_grades);
    await expect(
      insertRow(db, 'explanation_grades', { ...baseRows.explanation_grades, id: 'grade-2' }),
    ).rejects.toThrow('UNIQUE constraint failed: explanation_grades.review_log_id');
  });
});

describe('curso, matéria e materiais (D-056, D-063)', () => {
  test('matéria grava com e sem curso', async () => {
    await insertRow(db, 'subjects', {
      ...baseRows.subjects,
      id: 'subject-2',
      name: 'Matéria sem curso',
      program_id: null,
    });
    expect(await count('subjects')).toBe(2);
  });

  test('apagar um curso que tem matéria é recusado (RESTRICT)', async () => {
    await expect(remove('programs', 'program-1')).rejects.toThrow(FK_FAILED);
    expect(await count('programs')).toBe(1);
  });

  test('dois materiais com o mesmo path são recusados', async () => {
    await insertRow(db, 'materials', baseRows.materials);
    await expect(
      insertRow(db, 'materials', { ...baseRows.materials, id: 'material-2', title: 'Outro' }),
    ).rejects.toThrow('UNIQUE constraint failed: materials.path');
  });

  test('dois materiais com a mesma url são recusados', async () => {
    const link: Row = {
      ...baseRows.materials,
      kind: 'link',
      path: null,
      url: 'https://example.com/aula',
    };
    await insertRow(db, 'materials', link);
    await expect(insertRow(db, 'materials', { ...link, id: 'material-2' })).rejects.toThrow(
      'UNIQUE constraint failed: materials.url',
    );
  });

  test('dois materiais sem path são aceitos', async () => {
    const book: Row = { ...baseRows.materials, kind: 'livro', path: null };
    await insertRow(db, 'materials', book);
    await insertRow(db, 'materials', { ...book, id: 'material-2', title: 'Outro livro' });
    expect(await count('materials')).toBe(2);
  });

  test('path só em pdf e markdown', async () => {
    await expectCheckRefused(
      'materials',
      { ...baseRows.materials, kind: 'livro', path: 'livro.pdf' },
      'materials_path_by_kind',
    );
  });
});

describe('o que acontece ao apagar (D-061 a D-063)', () => {
  test('apagar matéria com Ofício é recusado (RESTRICT)', async () => {
    await expect(remove('subjects', 'subject-1')).rejects.toThrow(FK_FAILED);
    expect(await count('skills')).toBe(1);
  });

  test('apagar um Ofício sem tentativa leva os itens dele (CASCADE)', async () => {
    await insertRow(db, 'items', baseRows.items);
    await remove('skills', 'skill-1');
    expect(await count('items')).toBe(0);
  });

  test('apagar um Ofício com tentativa é recusado: o histórico segura (RESTRICT)', async () => {
    await insertItemAndLog();
    await expect(remove('skills', 'skill-1')).rejects.toThrow(FK_FAILED);
    expect(await count('items')).toBe(1);
    expect(await count('review_logs')).toBe(1);
  });

  test('apagar um material deixa Ofício e item sem fonte e desfaz o vínculo', async () => {
    await insertRow(db, 'materials', baseRows.materials);
    await insertRow(db, 'material_skills', baseRows.material_skills);
    await db.execute("UPDATE skills SET source_material_id = 'material-1'");
    await insertRow(db, 'items', { ...baseRows.items, source_material_id: 'material-1' });

    await remove('materials', 'material-1');

    expect(await count('material_skills')).toBe(0);
    const { rows } = await db.execute(
      'SELECT (SELECT source_material_id FROM skills) AS skill, (SELECT source_material_id FROM items) AS item',
    );
    expect(rows[0]).toMatchObject({ skill: null, item: null });
  });
});

describe('planos e importações (D-063)', () => {
  beforeEach(async () => {
    await insertRow(db, 'plans', baseRows.plans);
  });

  test('bloco pulado é uma linha sem Ofício', async () => {
    await insertRow(db, 'plan_items', baseRows.plan_items);
    await insertRow(db, 'plan_items', {
      ...baseRows.plan_items,
      id: 'plan-item-2',
      position: 1,
      skill_id: null,
      skipped: 1,
    });
    expect(await count('plan_items')).toBe(2);
    await expectCheckRefused(
      'plan_items',
      { ...baseRows.plan_items, id: 'plan-item-3', position: 2, skill_id: null },
      'plan_items_skill_iff_not_skipped',
    );
  });

  test('o tipo do item do plano acompanha o número do bloco', async () => {
    await expectCheckRefused(
      'plan_items',
      { ...baseRows.plan_items, block: 2 },
      'plan_items_kind_by_block',
    );
  });

  test('importação de conteúdo não grava notas', async () => {
    await expectCheckRefused(
      'imports',
      { ...baseRows.imports, kind: 'conteudo' },
      'imports_counts_by_kind',
    );
  });
});
