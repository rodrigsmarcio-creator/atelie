import type { Client, InValue } from '@libsql/client';
import { createDb } from './client';
import { runMigrations } from './migrate';

// Ajudante dos testes que rodam contra o banco da migration 0000 (ATL-72).
// Não é exportado pelo pacote; só os `*.test.ts` importam.

// Banco em memória com a 0000 aplicada. Abre pelo createDb, o mesmo caminho do
// app (chave estrangeira ligada). Sem arquivo: no Windows o libsql só solta um
// `file:` quando o processo termina (D-064). Quem chama fecha o cliente.
export async function openMigratedDb(): Promise<Client> {
  const db = await createDb(':memory:');
  await runMigrations(db.$client);
  return db.$client;
}

export type Row = Record<string, InValue>;

const AT = '2026-01-01T12:00:00.000Z';
const EXPLANATION = 'Explicação de teste com mais de vinte caracteres.';

// Uma linha válida por tabela, com dados inventados e IDs fixos (nada real).
// Os testes trocam só o campo do caso, para cada caso errado quebrar uma regra
// só e a recusa vir com o nome dela.
export const baseRows = {
  programs: {
    id: 'program-1',
    name: 'Curso de teste',
    reference: 'Curso fictício, Instituição fictícia, 2026',
    created_at: AT,
    updated_at: AT,
  },
  subjects: {
    id: 'subject-1',
    name: 'Matéria de teste',
    program_id: 'program-1',
    color: '#336699',
    icon: 'book',
    created_at: AT,
    updated_at: AT,
  },
  materials: {
    id: 'material-1',
    kind: 'pdf',
    title: 'Apostila de teste',
    path: 'apostila-teste.pdf',
    created_at: AT,
    updated_at: AT,
  },
  skills: {
    id: 'skill-1',
    subject_id: 'subject-1',
    name: 'Ofício de teste',
    icon: 'star',
    depth: 1,
    estimated_minutes: 20,
    origin: 'manual',
    created_at: AT,
    updated_at: AT,
  },
  // O Ofício `skill-2` (seedEveryTable) tem o `skill-1` como pré-requisito.
  skill_prereqs: { skill_id: 'skill-2', prereq_id: 'skill-1', created_at: AT },
  material_skills: {
    material_id: 'material-1',
    skill_id: 'skill-1',
    page_from: 1,
    page_to: 2,
    created_at: AT,
  },
  // Exercício geral de múltipla escolha: sem dimensão, 4 alternativas.
  items: {
    id: 'item-1',
    skill_id: 'skill-1',
    kind: 'multipla_escolha',
    prompt: 'Enunciado de teste',
    options_json: '["a","b","c","d"]',
    answer: 'a',
    explanation: EXPLANATION,
    origin: 'manual',
    created_at: AT,
    updated_at: AT,
  },
  memory_states: {
    item_id: 'item-1',
    algo_version: 'ts-fsrs-5.4.2',
    created_at: AT,
    updated_at: AT,
  },
  review_logs: {
    id: 'log-1',
    item_id: 'item-1',
    skill_id: 'skill-1',
    reviewed_at: AT,
    mode: 'sessao',
    correct: 1,
    answer_ms: 1000,
    created_at: AT,
  },
  imports: {
    id: 'import-1',
    kind: 'notas_explicacao',
    file_name: 'notas-explicacao-teste.json',
    file_hash: 'hash-de-teste',
    ran_at: AT,
    grades_inserted: 1,
  },
  explanation_grades: {
    id: 'grade-1',
    review_log_id: 'log-1',
    skill_id: 'skill-1',
    correcao: 2,
    justificativa: 2,
    coerencia: 1,
    aplicacao: 1,
    limitacoes: 0,
    graded_at: AT,
    import_id: 'import-1',
    created_at: AT,
  },
  proofs: { skill_id: 'skill-1', kind: 'conceitual', review_log_id: 'log-1', earned_at: AT },
  plans: {
    id: 'plan-1',
    generated_at: AT,
    mode: 'completa',
    params_json: '{}',
    state_hash: 'hash-de-teste',
  },
  plan_items: {
    id: 'plan-item-1',
    plan_id: 'plan-1',
    block: 1,
    position: 0,
    kind: 'revisao_previa',
    skill_id: 'skill-1',
    minutes: 10,
    reason_json: '{}',
    created_at: AT,
    updated_at: AT,
  },
  settings: { key: 'timezone', value_json: '"America/Sao_Paulo"', created_at: AT, updated_at: AT },
} satisfies Record<string, Row>;

export type TableName = keyof typeof baseRows;

// INSERT com os valores como parâmetros; as colunas vêm das chaves da linha.
export async function insertRow(client: Client, table: TableName, row: Row) {
  const columns = Object.keys(row);
  await client.execute({
    sql: `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
    args: Object.values(row),
  });
}

// Uma linha em cada uma das 15 tabelas, da mãe para a filha.
export async function seedEveryTable(client: Client) {
  await insertRow(client, 'programs', baseRows.programs);
  await insertRow(client, 'subjects', baseRows.subjects);
  await insertRow(client, 'materials', baseRows.materials);
  await insertRow(client, 'skills', baseRows.skills);
  await insertRow(client, 'skills', { ...baseRows.skills, id: 'skill-2', name: 'Segundo Ofício' });
  await insertRow(client, 'skill_prereqs', baseRows.skill_prereqs);
  await insertRow(client, 'material_skills', baseRows.material_skills);
  await insertRow(client, 'items', baseRows.items);
  await insertRow(client, 'memory_states', baseRows.memory_states);
  await insertRow(client, 'review_logs', baseRows.review_logs);
  await insertRow(client, 'imports', baseRows.imports);
  await insertRow(client, 'explanation_grades', baseRows.explanation_grades);
  await insertRow(client, 'proofs', baseRows.proofs);
  await insertRow(client, 'plans', baseRows.plans);
  await insertRow(client, 'plan_items', baseRows.plan_items);
  await insertRow(client, 'settings', baseRows.settings);
}
