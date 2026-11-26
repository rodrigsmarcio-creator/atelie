import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baseRows, insertRow, openMigratedDrizzle } from '../test-db';
import {
  SKILL_A,
  SKILL_B,
  completeFile,
  fullItems,
  id,
  rawItem,
  rawSkill,
  rubric,
  times,
  type Raw,
} from './builders';
import { exampleCursoEstudo } from './fixtures';
import { parseImportFile } from './schema';
import { runImport, type RunResult } from './run';

// A tabela das recusas do docs/09 (ATL-75): para cada uma, um arquivo válido e
// um (ou mais) inválido, passando pelo caminho inteiro do `import:run`: Zod,
// conferência do arquivo, conferência contra o banco e gravação. Cada recusa
// confere o lugar (`path`) e o motivo do erro, e que o arquivo recusado não
// gravou nada. O que cada camada faz sozinha já tem teste nos arquivos ao lado
// (schema, check, validate, run); aqui o ponto é não faltar nenhuma recusa.
//
// As recusas 11, 12 e 14 a 16 são do ATL-136 e têm a tabela delas em
// schema.test.ts e validate.test.ts; o último teste daqui só confere que o
// arquivo de exemplo do ATL-136 roda junto.

type TestDb = Awaited<ReturnType<typeof openMigratedDrizzle>>;

let db: TestDb;
beforeEach(async () => {
  db = await openMigratedDrizzle();
});
afterEach(() => {
  db.$client.close();
});

const SUBJECT_ID = '01JCXAM0000000000000SUBJ01';
const OTHER_SUBJECT_ID = id('SB', 2);
const MATERIAL = id('MT', 1);

// Linhas que já estão no banco antes da importação.
async function seedSubject(patch: Record<string, string | number | null> = {}) {
  await insertRow(db.$client, 'subjects', {
    ...baseRows.subjects,
    program_id: null,
    id: SUBJECT_ID,
    name: 'Cálculo I',
    ...patch,
  });
}

async function seedSkill(skillId: string, patch: Record<string, string | number | null> = {}) {
  await insertRow(db.$client, 'skills', {
    ...baseRows.skills,
    id: skillId,
    subject_id: SUBJECT_ID,
    name: `Ofício do banco ${skillId.slice(-4)}`,
    ...patch,
  });
}

async function seedEdge(skillId: string, prereqId: string) {
  await insertRow(db.$client, 'skill_prereqs', {
    ...baseRows.skill_prereqs,
    skill_id: skillId,
    prereq_id: prereqId,
  });
}

async function seedItem(itemId: string, skillId: string) {
  await insertRow(db.$client, 'items', { ...baseRows.items, id: itemId, skill_id: skillId });
}

// Mexer em um arquivo cru: troca (ou tira) campos de um item ou de um Ofício.
const without = (obj: Raw, keys: string[]): Raw =>
  Object.fromEntries(Object.entries(obj).filter(([name]) => !keys.includes(name)));

function patchItem(file: Raw, index: number, patch: Raw, drop: string[] = []): Raw {
  const items = (file['items'] as Raw[]).map((item, i) =>
    i === index ? { ...without(item, drop), ...patch } : item,
  );
  return { ...file, items };
}

function patchSkill(file: Raw, index: number, patch: Raw): Raw {
  const skills = (file['skills'] as Raw[]).map((skill, i) =>
    i === index ? { ...skill, ...patch } : skill,
  );
  return { ...file, skills };
}

// Posições no arquivo completo: o Ofício 1 tem os itens 0 a 27 (0 a 3 conceituais
// abertos, 1 é a múltipla escolha, 4 a 15 fluência, 16 a 23 problemas, 24 a
// explicação e 25 a 27 cartões).
const ABERTO = 0;
const MULTIPLA_ESCOLHA = 1;
const FLUENCIA = 4;
const EXPLICACAO = 24;
const CARTAO = 25;

type Scenario = { file: Raw; seed?: () => Promise<void> };
type Invalid = {
  label: string;
  scenario: () => Scenario;
  path: string;
  message: string;
};
type Refusal = {
  number: number;
  title: string;
  valid: () => Scenario;
  invalid: Invalid[];
};

const ok = (): Scenario => ({ file: completeFile() });

const REFUSALS: Refusal[] = [
  {
    number: 1,
    title: 'version diferente de 1',
    valid: ok,
    invalid: [
      {
        label: 'version 2',
        scenario: () => ({ file: completeFile({ version: 2 }) }),
        path: 'version',
        message: 'deve ser 1',
      },
    ],
  },
  {
    number: 2,
    title: 'ULID inválido ou repetido no arquivo',
    valid: ok,
    invalid: [
      {
        label: 'ID de Ofício repetido',
        scenario: () => ({
          file: completeFile({ skills: [rawSkill(1), rawSkill(1, { name: 'Outro' })] }),
        }),
        path: 'skills[1].id',
        message: 'repetido',
      },
      {
        label: 'ID de Ofício com minúscula',
        scenario: () => ({
          file: patchSkill(completeFile(), 0, { id: id('SK', 1).toLowerCase() }),
        }),
        path: 'skills[0].id',
        message: 'ID inválido',
      },
      {
        label: 'ID de item repetido',
        scenario: () => {
          const file = completeFile();
          const first = (file['items'] as Raw[])[0];
          return { file: patchItem(file, 1, { id: first?.['id'] }) };
        },
        path: 'items[1].id',
        message: 'repetido',
      },
    ],
  },
  {
    number: 3,
    title: 'pré-requisito que não existe (arquivo + banco)',
    valid: () => ({
      // O pré-requisito é um Ofício que só existe no banco, em outra matéria.
      file: completeFile({
        skills: [rawSkill(1, { prereqs: [id('SK', 50)] })],
        items: fullItems(SKILL_A),
      }),
      seed: async () => {
        await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Álgebra' });
        await seedSkill(id('SK', 50), { subject_id: OTHER_SUBJECT_ID, depth: 5 });
      },
    }),
    invalid: [
      {
        label: 'ID que não está no arquivo nem no banco',
        scenario: () => ({
          file: completeFile({
            skills: [rawSkill(1, { prereqs: [id('SK', 99)] })],
            items: fullItems(SKILL_A),
          }),
        }),
        path: 'skills[0].prereqs[0]',
        message: 'não existe no arquivo nem no banco',
      },
    ],
  },
  {
    number: 4,
    title: 'ciclo no grafo (arquivo + banco)',
    valid: ok,
    invalid: [
      {
        label: 'dois Ofícios do arquivo que se exigem',
        scenario: () => ({
          file: completeFile({
            skills: [
              rawSkill(1, { depth: 1, prereqs: [SKILL_B] }),
              rawSkill(2, { depth: 2, prereqs: [SKILL_A] }),
            ],
          }),
        }),
        path: 'skills[0].prereqs',
        message: 'ciclo',
      },
      {
        label: 'ciclo que fecha por uma aresta que já está no banco',
        scenario: () => ({
          // No banco o 2 exige o 1; o arquivo faz o 1 exigir o 2.
          file: completeFile({
            skills: [rawSkill(1, { depth: 3, prereqs: [SKILL_B] })],
            items: fullItems(SKILL_A),
          }),
          seed: async () => {
            await seedSubject();
            await seedSkill(SKILL_A, { name: 'Ofício 1', depth: 1 });
            await seedSkill(SKILL_B, { name: 'Ofício 2', depth: 2 });
            await seedEdge(SKILL_B, SKILL_A);
          },
        }),
        path: 'skills[0].prereqs',
        message: 'ciclo',
      },
    ],
  },
  {
    number: 5,
    title: 'depth menor ou igual ao do pré-requisito da mesma matéria',
    valid: ok,
    invalid: [
      {
        label: 'depth igual ao do pré-requisito',
        scenario: () => ({
          file: completeFile({
            skills: [rawSkill(1, { depth: 2 }), rawSkill(2, { depth: 2, prereqs: [SKILL_A] })],
          }),
        }),
        path: 'skills[1].depth',
        message: 'maior que o do pré-requisito',
      },
    ],
  },
  {
    number: 6,
    title: 'item sem explanation ou com menos de 20 caracteres',
    valid: ok,
    invalid: [
      {
        label: 'explanation com 19 caracteres',
        scenario: () => ({
          file: patchItem(completeFile(), ABERTO, { explanation: 'a'.repeat(19) }),
        }),
        path: 'items[0].explanation',
        message: 'ao menos 20 caracteres',
      },
      {
        label: 'sem explanation',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, {}, ['explanation']) }),
        path: 'items[0].explanation',
        message: 'esperava',
      },
    ],
  },
  {
    number: 7,
    title: 'options e answer incoerentes com o tipo do item',
    valid: ok,
    invalid: [
      {
        label: 'múltipla escolha com 3 alternativas',
        scenario: () => ({
          file: patchItem(completeFile(), MULTIPLA_ESCOLHA, { options: ['a', 'b', 'c'] }),
        }),
        path: 'items[1].options',
        message: 'exatamente 4',
      },
      {
        label: 'answer fora de 0 a 3 na múltipla escolha',
        scenario: () => ({ file: patchItem(completeFile(), MULTIPLA_ESCOLHA, { answer: 4 }) }),
        path: 'items[1].answer',
        message: '0 a 3',
      },
      {
        label: 'aberta com options',
        scenario: () => ({
          file: patchItem(completeFile(), ABERTO, { options: ['a', 'b', 'c', 'd'] }),
        }),
        path: 'items[0].options',
        message: 'aberta',
      },
    ],
  },
  {
    number: 8,
    title: 'Ofício com menos de 3 ou mais de 60 itens',
    valid: ok,
    invalid: [
      {
        label: '2 itens',
        scenario: () => ({
          file: completeFile({ skills: [rawSkill(1)], items: times(2, () => rawItem()) }),
        }),
        path: 'skills[0]',
        message: 'ficaria com 2 ite',
      },
      {
        label: '61 itens',
        scenario: () => ({
          file: completeFile({ skills: [rawSkill(1)], items: times(61, () => rawItem()) }),
        }),
        path: 'skills[0]',
        message: 'ficaria com 61 ite',
      },
    ],
  },
  {
    number: 9,
    title: 'origin "manual" em arquivo gerado pela Jane',
    valid: () => ({
      file: patchSkill(completeFile({ generated_by: 'manual/Márcio' }), 0, { origin: 'manual' }),
    }),
    invalid: [
      {
        label: 'Ofício manual com generated_by da Jane',
        scenario: () => ({ file: patchSkill(completeFile(), 0, { origin: 'manual' }) }),
        path: 'skills[0].origin',
        message: 'gerado pela Jane',
      },
      {
        label: 'item manual com generated_by da Jane',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { origin: 'manual' }) }),
        path: 'items[0].origin',
        message: 'gerado pela Jane',
      },
    ],
  },
  {
    number: 10,
    title: 'focus em item; dimension em cartão',
    valid: ok,
    invalid: [
      {
        label: 'campo focus',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { focus: 'conceitual' }) }),
        path: 'items[0].focus',
        message: 'dimension',
      },
      {
        label: 'dimension em cartão',
        scenario: () => ({
          file: patchItem(completeFile(), CARTAO, { dimension: 'conceitual' }),
        }),
        path: 'items[25].dimension',
        message: 'cartão',
      },
    ],
  },
  {
    number: 13,
    title: 'material_id que não existe no banco',
    valid: () => ({
      file: patchSkill(completeFile(), 0, {
        source: { material_id: MATERIAL, page_from: 1, page_to: 2 },
      }),
      seed: async () => {
        await insertRow(db.$client, 'materials', {
          ...baseRows.materials,
          id: MATERIAL,
          path: 'apostila.pdf',
        });
      },
    }),
    invalid: [
      {
        label: 'source do Ofício',
        scenario: () => ({
          file: patchSkill(completeFile(), 0, {
            source: { material_id: MATERIAL, page_from: 1, page_to: 2 },
          }),
        }),
        path: 'skills[0].source.material_id',
        message: 'não existe no banco',
      },
      {
        label: 'source do item',
        scenario: () => ({
          file: patchItem(completeFile(), ABERTO, { source: { material_id: MATERIAL, page: 3 } }),
        }),
        path: 'items[0].source.material_id',
        message: 'não existe no banco',
      },
    ],
  },
  {
    number: 17,
    title: 'campo de dimensão fora da dimensão dele (ou faltando nela)',
    valid: ok,
    invalid: [
      {
        label: 'evidence em item de fluência',
        scenario: () => ({
          file: patchItem(completeFile(), FLUENCIA, { evidence: 'reconhecimento' }),
        }),
        path: 'items[4].evidence',
        message: 'conceitual',
      },
      {
        label: 'category em item conceitual',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { category: 'rotineira' }) }),
        path: 'items[0].category',
        message: 'problemas',
      },
      {
        label: 'expected_seconds em item conceitual',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { expected_seconds: 30 }) }),
        path: 'items[0].expected_seconds',
        message: 'fluencia',
      },
      {
        label: 'followup em item conceitual',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { followup: 'E se...?' }) }),
        path: 'items[0].followup',
        message: 'explicacao',
      },
      {
        label: 'rubric em item conceitual',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, { rubric }) }),
        path: 'items[0].rubric',
        message: 'explicacao',
      },
      {
        label: 'item conceitual sem evidence',
        scenario: () => ({ file: patchItem(completeFile(), ABERTO, {}, ['evidence']) }),
        path: 'items[0].evidence',
        message: 'conceitual',
      },
    ],
  },
  {
    number: 18,
    title: 'interpretacao fora de múltipla escolha; explicação que não é aberta',
    valid: ok,
    invalid: [
      {
        label: 'interpretacao em item aberto',
        scenario: () => ({
          file: patchItem(completeFile(), ABERTO, { evidence: 'interpretacao' }),
        }),
        path: 'items[0].evidence',
        message: 'interpretacao',
      },
      {
        label: 'item de explicação que é cartão',
        scenario: () => ({ file: patchItem(completeFile(), EXPLICACAO, { kind: 'cartao' }) }),
        path: 'items[24].kind',
        message: 'aberta',
      },
    ],
  },
  {
    number: 19,
    title: 'rubric sem as 5 chaves, com chave a mais ou com texto fora de 1 a 300',
    valid: ok,
    invalid: [
      {
        label: 'sem uma das chaves',
        scenario: () => ({
          file: patchItem(completeFile(), EXPLICACAO, {
            rubric: without(rubric as Raw, ['limitacoes']),
          }),
        }),
        path: 'items[24].rubric.limitacoes',
        message: 'esperava',
      },
      {
        label: 'chave a mais',
        scenario: () => ({
          file: patchItem(completeFile(), EXPLICACAO, {
            rubric: { ...(rubric as Raw), extra: 'texto' },
          }),
        }),
        path: 'items[24].rubric.extra',
        message: 'campo desconhecido',
      },
      {
        label: 'texto com 301 caracteres',
        scenario: () => ({
          file: patchItem(completeFile(), EXPLICACAO, {
            rubric: { ...(rubric as Raw), limitacoes: 'a'.repeat(301) },
          }),
        }),
        path: 'items[24].rubric.limitacoes',
        message: '300',
      },
      {
        label: 'texto vazio',
        scenario: () => ({
          file: patchItem(completeFile(), EXPLICACAO, {
            rubric: { ...(rubric as Raw), limitacoes: '' },
          }),
        }),
        path: 'items[24].rubric.limitacoes',
        message: '>= 1 caracteres',
      },
    ],
  },
  {
    number: 20,
    title: 'not_applicable com valor que não vale',
    valid: ok,
    invalid: [
      {
        label: 'conceitual',
        scenario: () => ({
          file: patchSkill(completeFile(), 0, { not_applicable: ['conceitual'] }),
        }),
        path: 'skills[0].not_applicable[0]',
        message: 'conceitual',
      },
      {
        label: 'autonomia',
        scenario: () => ({
          file: patchSkill(completeFile(), 0, { not_applicable: ['autonomia'] }),
        }),
        path: 'skills[0].not_applicable[0]',
        message: 'autonomia',
      },
      {
        label: 'valor desconhecido',
        scenario: () => ({ file: patchSkill(completeFile(), 0, { not_applicable: ['outra'] }) }),
        path: 'skills[0].not_applicable[0]',
        message: 'dimensão desconhecida',
      },
      {
        label: 'valor repetido',
        scenario: () => ({
          file: patchSkill(completeFile(), 0, { not_applicable: ['fluencia', 'fluencia'] }),
        }),
        path: 'skills[0].not_applicable',
        message: 'não pode repetir',
      },
    ],
  },
  {
    number: 21,
    title: 'matéria com o nome de outra matéria do banco',
    valid: () => ({
      // A mesma matéria (mesmo ID e nome) é um reaproveitamento, não um conflito.
      file: completeFile(),
      seed: async () => seedSubject(),
    }),
    invalid: [
      {
        label: 'outro ID, mesmo nome',
        scenario: () => ({
          file: completeFile(),
          seed: async () => seedSubject({ id: OTHER_SUBJECT_ID, name: 'Cálculo I' }),
        }),
        path: 'subject.name',
        message: 'já existe outra matéria',
      },
    ],
  },
  {
    number: 22,
    title: 'Ofício com o nome de outro Ofício da mesma matéria',
    valid: () => ({
      file: completeFile(),
      seed: async () => {
        await seedSubject();
        await seedSkill(id('SK', 70), { name: 'Outro nome' });
      },
    }),
    invalid: [
      {
        label: 'outro ID, mesmo nome',
        scenario: () => ({
          file: completeFile(),
          seed: async () => {
            await seedSubject();
            await seedSkill(id('SK', 70), { name: 'Ofício 1' });
          },
        }),
        path: 'skills[0].name',
        message: 'já tem outro Ofício',
      },
    ],
  },
  {
    number: 23,
    title: 'Ofício cujo ID já existe em outra matéria',
    valid: () => ({
      // O Ofício já existe na matéria do arquivo: é atualização.
      file: completeFile(),
      seed: async () => {
        await seedSubject();
        await seedSkill(SKILL_A, { name: 'Ofício 1' });
      },
    }),
    invalid: [
      {
        label: 'Ofício de outra matéria',
        scenario: () => ({
          file: completeFile(),
          seed: async () => {
            await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Álgebra' });
            await seedSkill(SKILL_A, { subject_id: OTHER_SUBJECT_ID, name: 'Outro nome' });
          },
        }),
        path: 'skills[0].id',
        message: 'de outra matéria',
      },
    ],
  },
  {
    number: 24,
    title: 'item cujo ID já existe em outro Ofício',
    valid: () => {
      const file = completeFile();
      const first = (file['items'] as Raw[])[0];
      return {
        // O item já existe no mesmo Ofício: é atualização.
        file,
        seed: async () => {
          await seedSubject();
          await seedSkill(SKILL_A, { name: 'Ofício 1' });
          await seedItem(String(first?.['id']), SKILL_A);
        },
      };
    },
    invalid: [
      {
        label: 'item de outro Ofício',
        scenario: () => {
          const file = completeFile();
          const first = (file['items'] as Raw[])[0];
          return {
            file,
            seed: async () => {
              await seedSubject();
              await seedSkill(id('SK', 70), { name: 'Outro' });
              await seedItem(String(first?.['id']), id('SK', 70));
            },
          };
        },
        path: 'items[0].id',
        message: 'de outro Ofício',
      },
    ],
  },
  {
    number: 25,
    title: 'item com skill_id que não existe',
    valid: () => ({
      // O Ofício do item só existe no banco, e já tem itens de sobra.
      file: completeFile({
        skills: [rawSkill(1)],
        items: [...fullItems(SKILL_A), rawItem({ skill_id: id('SK', 70) })],
      }),
      seed: async () => {
        await seedSubject();
        await seedSkill(id('SK', 70), { name: 'Do banco' });
        for (let n = 0; n < 8; n += 1) await seedItem(id('DB', n + 1), id('SK', 70));
      },
    }),
    invalid: [
      {
        label: 'skill_id que não está no arquivo nem no banco',
        scenario: () => ({
          file: completeFile({
            skills: [rawSkill(1)],
            items: [...fullItems(SKILL_A), rawItem({ skill_id: id('SK', 99) })],
          }),
        }),
        path: 'items[28].skill_id',
        message: 'não existe no arquivo nem no banco',
      },
    ],
  },
];

// O caminho inteiro do `import:run`, sem o arquivo em disco: Zod (formato) e,
// passando, a conferência e a gravação. Devolve os erros no mesmo formato nos
// dois casos.
let importNumber = 0;
async function importar(raw: Raw): Promise<RunResult> {
  const parsed = parseImportFile(raw);
  if (!parsed.ok) return { ok: false, errors: parsed.errors, warnings: [] };
  return runImport(db, parsed.file, {
    fileName: 'arquivo.json',
    fileHash: 'hash-do-arquivo',
    now: '2026-11-26T10:00:00.000Z',
    newId: () => id('IM', (importNumber += 1)),
  });
}

const TABLES = [
  'programs',
  'subjects',
  'materials',
  'skills',
  'skill_prereqs',
  'material_skills',
  'items',
  'imports',
];

async function snapshot(): Promise<Record<string, unknown>> {
  const entries = await Promise.all(
    TABLES.map(async (table) => {
      const result = await db.$client.execute(`SELECT count(*) AS total FROM ${table}`);
      return [table, result.rows[0]?.['total']] as const;
    }),
  );
  return Object.fromEntries(entries);
}

describe('a tabela cobre todas as recusas deste ticket', () => {
  test('1 a 10, 13 e 17 a 25, sem repetir nem faltar', () => {
    const expected = [
      ...Array.from({ length: 10 }, (_, i) => i + 1),
      13,
      ...Array.from({ length: 9 }, (_, i) => i + 17),
    ];
    expect(REFUSALS.map((refusal) => refusal.number)).toEqual(expected);
  });

  test('toda recusa tem ao menos um arquivo inválido', () => {
    for (const refusal of REFUSALS) expect(refusal.invalid.length).toBeGreaterThan(0);
  });
});

describe.each(REFUSALS)('recusa $number: $title', (refusal) => {
  test('o arquivo válido passa e é gravado', async () => {
    const { file, seed } = refusal.valid();
    await seed?.();
    const result = await importar(file);
    if (!result.ok) throw new Error(`recusado: ${JSON.stringify(result.errors)}`);
    const after = await snapshot();
    expect(after['imports']).toBe(1);
    expect(after['items']).toBeGreaterThan(0);
  });

  test.each(refusal.invalid)('$label: recusado, com o motivo, sem gravar nada', async (invalid) => {
    const { file, seed } = invalid.scenario();
    await seed?.();
    const before = await snapshot();

    const result = await importar(file);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: invalid.path,
      message: expect.stringContaining(invalid.message),
    });
    expect(await snapshot()).toEqual(before);
  });
});

describe('junto com o ATL-136', () => {
  // O exemplo do ATL-136 mostra só o formato (um Ofício, sem itens, com pré-requisito
  // que não existe). Passa pelo Zod e as regras novas (curso, material, estudo)
  // não o recusam; só as de arquivo completo (3 e 8) o seguram, e nada é gravado.
  test('o arquivo de exemplo passa no formato e só é recusado por falta de conteúdo', async () => {
    const before = await snapshot();
    const result = await importar(exampleCursoEstudo);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.map((error) => error.path)).toEqual(['skills[0]', 'skills[0].prereqs[0]']);
    expect(await snapshot()).toEqual(before);
  });
});
