import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baseRows, insertRow, openMigratedDrizzle } from '../test-db';
import { SKILL_A, SKILL_B, completeFile, id, rawSkill, type Raw } from './builders';
import { exampleNotas } from './fixtures';
import { parseImportFile, type ParsedImportFile } from './schema';
import { runImport, type RunResult } from './run';

type TestDb = Awaited<ReturnType<typeof openMigratedDrizzle>>;

let db: TestDb;
beforeEach(async () => {
  db = await openMigratedDrizzle();
});
afterEach(() => {
  db.$client.close();
});

const NOW_1 = '2026-11-26T10:00:00.000Z';
const NOW_2 = '2026-11-27T10:00:00.000Z';
const MATERIAL = id('MT', 1);

function parse(raw: Raw): ParsedImportFile {
  const result = parseImportFile(raw);
  if (!result.ok) throw new Error(`arquivo inválido no formato: ${JSON.stringify(result.errors)}`);
  return result.file;
}

let importNumber = 0;
async function runFile(raw: Raw, now = NOW_1, fileHash = 'hash-do-arquivo'): Promise<RunResult> {
  return runImport(db, parse(raw), {
    fileName: 'arquivo.json',
    fileHash,
    now,
    newId: () => id('IM', (importNumber += 1)),
  });
}

async function expectOk(raw: Raw, now = NOW_1) {
  const result = await runFile(raw, now);
  if (!result.ok) throw new Error(`importação recusada: ${JSON.stringify(result.errors)}`);
  return result.summary;
}

type Cell = string | number | null;

async function rows(sql: string, args: Cell[] = []): Promise<Record<string, unknown>[]> {
  const result = await db.$client.execute({ sql, args });
  return result.rows.map((row) => ({ ...row }));
}

async function scalar(sql: string, args: Cell[] = []): Promise<unknown> {
  const [first] = await rows(sql, args);
  return first === undefined ? undefined : Object.values(first)[0];
}

const count = (table: string) => scalar(`SELECT count(*) FROM ${table}`);

function without(obj: Raw, ...keys: string[]): Raw {
  return Object.fromEntries(Object.entries(obj).filter(([name]) => !keys.includes(name)));
}

// Os itens e Ofícios do arquivo completo, com tipo, para mexer neles.
function parts(raw: Raw) {
  return { skills: raw['skills'] as Raw[], items: raw['items'] as Raw[] };
}

async function seedMaterial() {
  await insertRow(db.$client, 'materials', { ...baseRows.materials, id: MATERIAL, path: 'a.pdf' });
}

describe('primeira importação', () => {
  test('grava matéria, Ofícios, arestas e itens', async () => {
    const summary = await expectOk(completeFile());
    expect(await count('subjects')).toBe(1);
    expect(await count('skills')).toBe(2);
    expect(await count('skill_prereqs')).toBe(1);
    expect(await count('items')).toBe(56);
    expect(summary).toMatchObject({
      subject: { name: 'Cálculo I', created: true },
      skills: { inserted: 2, existing: 0 },
      items: { inserted: 56, existing: 0 },
    });
    expect(await rows('SELECT skill_id, prereq_id FROM skill_prereqs')).toEqual([
      { skill_id: SKILL_B, prereq_id: SKILL_A },
    ]);
  });

  test('registra a execução em imports', async () => {
    const summary = await expectOk(completeFile());
    expect(summary.importId).toBe(id('IM', importNumber));
    expect(await rows('SELECT * FROM imports')).toEqual([
      {
        id: summary.importId,
        kind: 'conteudo',
        file_name: 'arquivo.json',
        file_hash: 'hash-do-arquivo',
        ran_at: NOW_1,
        skills_inserted: 2,
        items_inserted: 56,
        grades_inserted: 0,
        skipped: 0,
        errors_json: '[]',
      },
    ]);
  });

  test('grava os valores como o docs/04 manda', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const { items } = parts(raw);
    const me = items.find((item) => item['kind'] === 'multipla_escolha');
    const explicacao = items.find((item) => item['dimension'] === 'explicacao');
    const [meRow] = await rows('SELECT * FROM items WHERE id = ?', [String(me?.['id'])]);
    // O índice da alternativa certa vira texto; as alternativas, JSON.
    expect(meRow).toMatchObject({
      kind: 'multipla_escolha',
      answer: '0',
      options_json: '["a","b","c","d"]',
      dimension: 'conceitual',
      evidence: 'interpretacao',
      origin: 'ia',
      reviewed_by_user: 0,
      created_at: NOW_1,
      updated_at: NOW_1,
    });
    const [explicacaoRow] = await rows('SELECT * FROM items WHERE id = ?', [
      String(explicacao?.['id']),
    ]);
    expect(explicacaoRow).toMatchObject({ dimension: 'explicacao', followup: 'E se...?' });
    expect(JSON.parse(String(explicacaoRow?.['rubric_json']))).toHaveProperty('limitacoes');
    expect(await rows('SELECT name, color, weight, exam_at FROM subjects')).toEqual([
      { name: 'Cálculo I', color: '#5b8fd9', weight: 40, exam_at: '2026-11-22' },
    ]);
    expect(
      await rows('SELECT origin, reviewed_by_user, not_applicable_json FROM skills LIMIT 1'),
    ).toEqual([{ origin: 'ia', reviewed_by_user: 0, not_applicable_json: '[]' }]);
  });

  test('sem now nem newId, usa o relógio e gera um ULID', async () => {
    const result = await runImport(db, parse(completeFile()), {
      fileName: 'a.json',
      fileHash: 'h',
    });
    if (!result.ok) throw new Error('recusada');
    expect(result.summary.importId).toMatch(/^[0-9A-Z]{26}$/);
    const ranAt = String(await scalar('SELECT ran_at FROM imports'));
    expect(ranAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  });
});

describe('idempotência (upsert por ID)', () => {
  test('importar o mesmo arquivo de novo não duplica nada', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const second = await expectOk(raw, NOW_2);
    expect(await count('subjects')).toBe(1);
    expect(await count('skills')).toBe(2);
    expect(await count('skill_prereqs')).toBe(1);
    expect(await count('items')).toBe(56);
    expect(second).toMatchObject({
      subject: { created: false },
      skills: { inserted: 0, existing: 2 },
      items: { inserted: 0, existing: 56 },
    });
  });

  test('cada execução tem a sua linha em imports, com os que já existiam em skipped', async () => {
    const raw = completeFile();
    await expectOk(raw);
    await expectOk(raw, NOW_2);
    expect(
      await rows(
        'SELECT ran_at, skills_inserted, items_inserted, skipped FROM imports ORDER BY ran_at',
      ),
    ).toEqual([
      { ran_at: NOW_1, skills_inserted: 2, items_inserted: 56, skipped: 0 },
      { ran_at: NOW_2, skills_inserted: 0, items_inserted: 0, skipped: 58 },
    ]);
  });

  test('reviewed_by_user nunca volta de true para false', async () => {
    const raw = completeFile();
    await expectOk(raw);
    await db.$client.execute('UPDATE skills SET reviewed_by_user = 1');
    await db.$client.execute('UPDATE items SET reviewed_by_user = 1');
    await expectOk(raw, NOW_2); // o arquivo da Jane sempre diz false
    expect(await scalar('SELECT count(*) FROM skills WHERE reviewed_by_user = 0')).toBe(0);
    expect(await scalar('SELECT count(*) FROM items WHERE reviewed_by_user = 0')).toBe(0);
  });

  test('o arquivo que diz true marca como revisado', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const { skills, items } = parts(raw);
    await expectOk(
      {
        ...raw,
        skills: skills.map((s) => ({ ...s, reviewed_by_user: true })),
        items: items.map((i) => ({ ...i, reviewed_by_user: true })),
      },
      NOW_2,
    );
    expect(await scalar('SELECT count(*) FROM skills WHERE reviewed_by_user = 1')).toBe(2);
    expect(await scalar('SELECT count(*) FROM items WHERE reviewed_by_user = 1')).toBe(56);
  });

  test('o conteúdo muda, a criação não', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const { skills, items } = parts(raw);
    await expectOk(
      {
        ...raw,
        skills: skills.map((s, i) => (i === 0 ? { ...s, name: 'Nome novo', depth: 1 } : s)),
        items: items.map((item, i) => (i === 0 ? { ...item, prompt: 'Enunciado novo' } : item)),
      },
      NOW_2,
    );
    expect(
      await rows('SELECT name, created_at, updated_at FROM skills WHERE id = ?', [SKILL_A]),
    ).toEqual([{ name: 'Nome novo', created_at: NOW_1, updated_at: NOW_2 }]);
    expect(
      await rows('SELECT prompt, created_at, updated_at FROM items WHERE id = ?', [
        String(items[0]?.['id']),
      ]),
    ).toEqual([{ prompt: 'Enunciado novo', created_at: NOW_1, updated_at: NOW_2 }]);
  });

  test('o item pode mudar de tipo: options e provas seguem o arquivo', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const { items } = parts(raw);
    const me = items.find((item) => item['kind'] === 'multipla_escolha');
    if (me === undefined) throw new Error('o arquivo completo tem uma ME');
    // Vira cartão dissertativo: sem options, sem dimensão, sem evidência.
    const cartao = {
      ...without(me, 'options', 'dimension', 'evidence'),
      kind: 'cartao',
      answer: 'texto',
    };
    await expectOk(
      { ...raw, items: items.map((item) => (item['id'] === me['id'] ? cartao : item)) },
      NOW_2,
    );
    expect(
      await rows('SELECT kind, answer, options_json, dimension, evidence FROM items WHERE id = ?', [
        String(me['id']),
      ]),
    ).toEqual([
      { kind: 'cartao', answer: 'texto', options_json: null, dimension: null, evidence: null },
    ]);
  });
});

describe('campo omitido', () => {
  test('não apaga o que o banco já tem (matéria, Ofício, item)', async () => {
    await seedMaterial();
    const raw = completeFile();
    const { skills, items } = parts(raw);
    const first = {
      ...raw,
      skills: skills.map((s, i) =>
        i === 0
          ? {
              ...s,
              label: 'Curto',
              description: 'Primeira descrição.',
              source: { material_id: MATERIAL, page_from: 1, page_to: 5 },
            }
          : s,
      ),
      items: items.map((item, i) =>
        i === 0 ? { ...item, difficulty: 2, source: { material_id: MATERIAL, page: 3 } } : item,
      ),
    };
    await expectOk(first);
    // O segundo arquivo não traz peso, prova, rótulo, descrição, dificuldade nem fonte.
    const second = {
      ...raw,
      subject: without(raw['subject'] as Raw, 'weight', 'exam_at'),
      skills: skills.map((s) => without(s, 'label', 'description', 'source')),
      items: items.map((item) => without(item, 'difficulty', 'source')),
    };
    await expectOk(second, NOW_2);
    expect(await rows('SELECT weight, exam_at FROM subjects')).toEqual([
      { weight: 40, exam_at: '2026-11-22' },
    ]);
    expect(
      await rows('SELECT label, description, source_material_id FROM skills WHERE id = ?', [
        SKILL_A,
      ]),
    ).toEqual([
      { label: 'Curto', description: 'Primeira descrição.', source_material_id: MATERIAL },
    ]);
    expect(
      await rows('SELECT difficulty, source_material_id, source_page FROM items WHERE id = ?', [
        String(items[0]?.['id']),
      ]),
    ).toEqual([{ difficulty: 2, source_material_id: MATERIAL, source_page: 3 }]);
    expect(await rows('SELECT page_from, page_to FROM material_skills')).toEqual([
      { page_from: 1, page_to: 5 },
    ]);
  });

  test('not_applicable ausente mantém; presente substitui', async () => {
    const raw = completeFile();
    const { skills } = parts(raw);
    const withNa = (value: unknown) => ({
      ...raw,
      skills: skills.map((s, i) => (i === 0 ? { ...s, not_applicable: value } : s)),
    });
    await expectOk(withNa(['fluencia']));
    await expectOk(raw, NOW_2); // sem o campo
    expect(await scalar('SELECT not_applicable_json FROM skills WHERE id = ?', [SKILL_A])).toBe(
      '["fluencia"]',
    );
    await expectOk(withNa([]), NOW_2);
    expect(await scalar('SELECT not_applicable_json FROM skills WHERE id = ?', [SKILL_A])).toBe(
      '[]',
    );
  });

  test('nos campos das provas, o item do arquivo é a verdade inteira (ausente vira nulo)', async () => {
    const raw = completeFile();
    const { items } = parts(raw);
    const fluencia = items.find((item) => item['dimension'] === 'fluencia');
    const explicacao = items.find((item) => item['dimension'] === 'explicacao');
    if (fluencia === undefined || explicacao === undefined) throw new Error('itens do exemplo');
    const first = {
      ...raw,
      items: items.map((item) => (item === fluencia ? { ...item, expected_seconds: 60 } : item)),
    };
    await expectOk(first);
    expect(
      await scalar('SELECT expected_seconds FROM items WHERE id = ?', [String(fluencia['id'])]),
    ).toBe(60);
    // Agora os dois viram exercícios gerais, sem nenhum campo de dimensão.
    const geral = (item: Raw) =>
      without(item, 'dimension', 'expected_seconds', 'followup', 'rubric');
    await expectOk(
      {
        ...raw,
        items: items.map((item) => (item === fluencia || item === explicacao ? geral(item) : item)),
      },
      NOW_2,
    );
    expect(
      await rows(
        'SELECT dimension, expected_seconds, followup, rubric_json FROM items WHERE id IN (?, ?)',
        [String(fluencia['id']), String(explicacao['id'])],
      ),
    ).toEqual([
      { dimension: null, expected_seconds: null, followup: null, rubric_json: null },
      { dimension: null, expected_seconds: null, followup: null, rubric_json: null },
    ]);
  });
});

describe('pré-requisitos substituídos', () => {
  test('o conjunto do arquivo vale para o Ofício que ele traz', async () => {
    const raw = completeFile();
    await expectOk(raw);
    const { skills } = parts(raw);
    const semAresta = {
      ...raw,
      skills: skills.map((s, i) => (i === 1 ? { ...s, prereqs: [] } : s)),
    };
    await expectOk(semAresta, NOW_2);
    expect(await count('skill_prereqs')).toBe(0);
    await expectOk(raw, NOW_2);
    expect(await count('skill_prereqs')).toBe(1);
  });

  test('as arestas de Ofício que não está no arquivo ficam como estão', async () => {
    const raw = completeFile();
    await expectOk(raw);
    // Segundo arquivo: só o SK0001. A aresta SK0002 -> SK0001 não é dele.
    const { skills, items } = parts(raw);
    await expectOk(
      {
        ...raw,
        skills: [skills[0]],
        items: items.filter((item) => item['skill_id'] === SKILL_A),
      },
      NOW_2,
    );
    expect(await rows('SELECT skill_id, prereq_id FROM skill_prereqs')).toEqual([
      { skill_id: SKILL_B, prereq_id: SKILL_A },
    ]);
  });
});

describe('fonte (material_id)', () => {
  test('liga o Ofício ao material com as páginas e o item à página', async () => {
    await seedMaterial();
    const raw = completeFile();
    const { skills, items } = parts(raw);
    await expectOk({
      ...raw,
      skills: skills.map((s, i) =>
        i === 1 ? { ...s, source: { material_id: MATERIAL, page_from: 10, page_to: 20 } } : s,
      ),
      items: items.map((item, i) =>
        i === 30 ? { ...item, source: { material_id: MATERIAL, page: 12 } } : item,
      ),
    });
    expect(
      await rows(
        'SELECT material_id, skill_id, page_from, page_to, created_at FROM material_skills',
      ),
    ).toEqual([
      { material_id: MATERIAL, skill_id: SKILL_B, page_from: 10, page_to: 20, created_at: NOW_1 },
    ]);
    expect(await scalar('SELECT source_material_id FROM skills WHERE id = ?', [SKILL_B])).toBe(
      MATERIAL,
    );
    expect(
      await rows('SELECT source_material_id, source_page FROM items WHERE id = ?', [
        String(items[30]?.['id']),
      ]),
    ).toEqual([{ source_material_id: MATERIAL, source_page: 12 }]);
  });

  test('importar de novo com outras páginas atualiza a mesma linha', async () => {
    await seedMaterial();
    const raw = completeFile();
    const { skills } = parts(raw);
    const withPages = (from: number, to: number) => ({
      ...raw,
      skills: skills.map((s, i) =>
        i === 1 ? { ...s, source: { material_id: MATERIAL, page_from: from, page_to: to } } : s,
      ),
    });
    await expectOk(withPages(10, 20));
    await expectOk(withPages(12, 30), NOW_2);
    expect(await rows('SELECT page_from, page_to FROM material_skills')).toEqual([
      { page_from: 12, page_to: 30 },
    ]);
  });

  test('o source sem páginas não apaga as que já estavam', async () => {
    await seedMaterial();
    const raw = completeFile();
    const { skills } = parts(raw);
    const withSource = (source: Raw) => ({
      ...raw,
      skills: skills.map((s, i) => (i === 1 ? { ...s, source } : s)),
    });
    await expectOk(withSource({ material_id: MATERIAL, page_from: 10, page_to: 20 }));
    await expectOk(withSource({ material_id: MATERIAL }), NOW_2);
    expect(await rows('SELECT page_from, page_to FROM material_skills')).toEqual([
      { page_from: 10, page_to: 20 },
    ]);
  });
});

describe('arquivo recusado', () => {
  test('não grava nada, nem a linha de imports, e devolve os erros e os avisos', async () => {
    const skills = [rawSkill(1, { prereqs: [id('SK', 99)] })];
    const result = await runFile(completeFile({ skills }));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors).toContainEqual({
      path: 'skills[0].prereqs[0]',
      message: expect.stringContaining('não existe no arquivo nem no banco'),
    });
    for (const table of ['subjects', 'skills', 'skill_prereqs', 'items', 'imports']) {
      expect(await count(table)).toBe(0);
    }
  });

  test('recusa pelo banco: matéria com o nome de outra', async () => {
    await runFile(completeFile());
    const other = completeFile({
      subject: { ...(completeFile()['subject'] as Raw), id: id('SB', 2) },
      skills: [rawSkill(7, { name: 'Outro' })],
      items: [],
    });
    const result = await runFile(other, NOW_2);
    expect(result.ok).toBe(false);
    expect(await count('subjects')).toBe(1);
    expect(await count('imports')).toBe(1);
  });

  test('o arquivo de notas ainda não se importa', async () => {
    const result = await runImport(db, parse(exampleNotas), { fileName: 'n.json', fileHash: 'h' });
    expect(result).toEqual({
      ok: false,
      errors: [{ path: '', message: 'importação de notas ainda não implementada' }],
      warnings: [],
    });
    expect(await count('imports')).toBe(0);
  });
});

describe('transação', () => {
  test('erro do banco no meio da gravação desfaz tudo', async () => {
    // O banco recusa o item "explosivo" na hora de gravar; o que veio antes volta.
    await db.$client.execute(
      `CREATE TRIGGER falha_no_meio BEFORE INSERT ON items WHEN NEW.prompt = 'explosivo'
       BEGIN SELECT RAISE(ABORT, 'explosivo'); END`,
    );
    const raw = completeFile();
    const { items } = parts(raw);
    const bomb = {
      ...raw,
      items: items.map((item, i) => (i === 40 ? { ...item, prompt: 'explosivo' } : item)),
    };
    await expect(runFile(bomb)).rejects.toThrow();
    for (const table of ['subjects', 'skills', 'skill_prereqs', 'items', 'imports']) {
      expect(await count(table)).toBe(0);
    }
  });
});

describe('avisos', () => {
  test('voltam no resultado de quem importou', async () => {
    const raw = completeFile();
    const { items } = parts(raw);
    const result = await runFile({
      ...raw,
      items: items.map((item, i) => (i === 0 ? { ...item, tags: ['a'] } : item)),
    });
    if (!result.ok) throw new Error('recusada');
    expect(result.summary.warnings).toEqual([
      { path: 'items', message: expect.stringContaining('"tags"') },
    ]);
  });
});
