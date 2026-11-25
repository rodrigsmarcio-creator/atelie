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
