import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { openMigratedDrizzle } from '../test-db';
import { completeFile, fullItems, id, rawSkill, SKILL_A, type Raw } from './builders';
import { runCli, type CliIo } from './cli';
import { exampleNotas } from './fixtures';

type TestDb = Awaited<ReturnType<typeof openMigratedDrizzle>>;

let db: TestDb;
let dir: string;
beforeEach(async () => {
  db = await openMigratedDrizzle();
  dir = await mkdtemp(join(tmpdir(), 'atelie-cli-'));
});
afterEach(async () => {
  db.$client.close();
  await rm(dir, { recursive: true, force: true });
});

async function fileWith(content: unknown, name = 'conteudo.json'): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}

// Banco já aberto: o comando não o fecha de verdade, para a mesma memória servir a vários comandos.
function makeIo(overrides: Partial<CliIo> = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    env: {},
    out: (line) => out.push(line),
    err: (line) => err.push(line),
    openDb: async () => ({ db, close: () => undefined }),
    ...overrides,
  };
  return { io, out, err, all: () => [...out, ...err].join('\n') };
}

async function count(table: string): Promise<unknown> {
  const result = await db.$client.execute(`SELECT count(*) AS n FROM ${table}`);
  return result.rows[0]?.['n'];
}

describe('uso e arquivo', () => {
  test.each([[[]], [['validate']], [['importar', 'a.json']], [['run', 'a.json', 'b.json']]])(
    'uso errado %j: mostra o uso e sai com 2',
    async (args) => {
      const { io, err } = makeIo();
      expect(await runCli(args, io)).toBe(2);
      expect(err.join('\n')).toContain('Uso: pnpm import:validate');
    },
  );

  test('arquivo que não existe', async () => {
    const { io, err } = makeIo();
    expect(await runCli(['validate', join(dir, 'nao-existe.json')], io)).toBe(1);
    expect(err.join('\n')).toContain('Não consegui ler');
  });

  test('JSON inválido', async () => {
    const { io, err } = makeIo();
    expect(await runCli(['validate', await fileWith('{ não é json')], io)).toBe(1);
    expect(err.join('\n')).toContain('não é um JSON válido');
  });

  test('formato errado: lista cada erro com o caminho e não toca no banco', async () => {
    const { io, err } = makeIo();
    const bad = {
      ...completeFile(),
      version: 2,
      subject: { ...(completeFile()['subject'] as Raw), color: 'azul' },
    };
    expect(await runCli(['run', await fileWith(bad)], io)).toBe(1);
    const text = err.join('\n');
    expect(text).toContain('ERRO   version: version deve ser 1');
    expect(text).toContain('ERRO   subject.color:');
    expect(text).toContain('Arquivo recusado: 2 erros. Nada foi gravado.');
    expect(await count('subjects')).toBe(0);
  });

  test('sem DATABASE_URL pede a variável, depois de o arquivo passar no formato', async () => {
    // Sem openDb: o comando tenta abrir o banco pelo ambiente, que está vazio.
    const err: string[] = [];
    const io: CliIo = { env: {}, out: () => undefined, err: (line) => err.push(line) };
    expect(await runCli(['validate', await fileWith(completeFile())], io)).toBe(1);
    expect(err.join('\n')).toContain('Defina DATABASE_URL');
  });
});

describe('import:validate', () => {
  test('arquivo completo: válido, sem gravar nada', async () => {
    const { io, out } = makeIo();
    expect(await runCli(['validate', await fileWith(completeFile())], io)).toBe(0);
    expect(out).toEqual(['Arquivo válido, sem erros e sem avisos.']);
    expect(await count('subjects')).toBe(0);
    expect(await count('imports')).toBe(0);
  });

  test('aviso não recusa: mostra e sai com 0', async () => {
    const raw = completeFile();
    const items = (raw['items'] as Raw[]).map((item, i) =>
      i === 0 ? { ...item, tags: ['a'] } : item,
    );
    const { io, out } = makeIo();
    expect(await runCli(['validate', await fileWith({ ...raw, items })], io)).toBe(0);
    expect(out[0]).toMatch(/^AVISO {2}items: 1 item com "tags"/);
    expect(out[1]).toBe('Arquivo válido, com 1 aviso.');
  });

  test('erro que só o banco vê: lista e sai com 1', async () => {
    const skills = [rawSkill(1, { prereqs: [id('SK', 99)] })];
    const { io, err } = makeIo();
    expect(
      await runCli(
        ['validate', await fileWith(completeFile({ skills, items: fullItems(SKILL_A) }))],
        io,
      ),
    ).toBe(1);
    expect(err.join('\n')).toContain('ERRO   skills[0].prereqs[0]:');
    expect(err.join('\n')).toContain('Nada foi gravado.');
  });

  test('arquivo de notas: confere o arquivo e avisa que o banco não é conferido', async () => {
    const { io, out } = makeIo();
    expect(await runCli(['validate', await fileWith(exampleNotas)], io)).toBe(0);
    expect(out.join('\n')).toContain('AVISO  (arquivo): a conferência das notas contra o banco');
  });
});

describe('import:run', () => {
  test('grava, resume e registra o arquivo com o hash dele', async () => {
    const raw = completeFile();
    const path = await fileWith(raw, 'calculo.json');
    const { io, out } = makeIo();
    expect(await runCli(['run', path], io)).toBe(0);
    expect(out.slice(0, 3)).toEqual([
      'Matéria "Cálculo I": nova.',
      'Ofícios: 2 novos, 0 já existiam.',
      'Itens: 56 novos, 0 já existiam.',
    ]);
    expect(out[3]).toMatch(/^Importação [0-9A-Z]{26} registrada\.$/);
    const [row] = (await db.$client.execute('SELECT file_name, file_hash FROM imports')).rows;
    expect(row?.['file_name']).toBe('calculo.json');
    expect(row?.['file_hash']).toBe(createHash('sha256').update(JSON.stringify(raw)).digest('hex'));
  });

  test('rodar o mesmo arquivo de novo não duplica', async () => {
    const path = await fileWith(completeFile());
    await runCli(['run', path], makeIo().io);
    const second = makeIo();
    expect(await runCli(['run', path], second.io)).toBe(0);
    expect(second.out.slice(0, 3)).toEqual([
      'Matéria "Cálculo I": já existia.',
      'Ofícios: 0 novos, 2 já existiam.',
      'Itens: 0 novos, 56 já existiam.',
    ]);
    expect(await count('skills')).toBe(2);
    expect(await count('items')).toBe(56);
    expect(await count('imports')).toBe(2);
  });

  test('arquivo recusado pelo banco: sai com 1 e não grava nada', async () => {
    const skills = [rawSkill(1, { prereqs: [id('SK', 99)] })];
    const { io, err } = makeIo();
    expect(
      await runCli(
        ['run', await fileWith(completeFile({ skills, items: fullItems(SKILL_A) }))],
        io,
      ),
    ).toBe(1);
    expect(err.join('\n')).toContain('Arquivo recusado: 1 erro. Nada foi gravado.');
    expect(await count('subjects')).toBe(0);
    expect(await count('imports')).toBe(0);
  });

  test('arquivo de notas: recusa até a importação de notas existir', async () => {
    const { io, err } = makeIo();
    expect(await runCli(['run', await fileWith(exampleNotas)], io)).toBe(1);
    expect(err.join('\n')).toContain('importação de notas ainda não implementada');
    expect(await count('imports')).toBe(0);
  });

  test('o banco é fechado no fim, com sucesso ou não', async () => {
    let closed = 0;
    const { io } = makeIo({ openDb: async () => ({ db, close: () => (closed += 1) }) });
    await runCli(['run', await fileWith(completeFile())], io);
    await runCli(['run', await fileWith(exampleNotas)], io);
    expect(closed).toBe(2);
  });
});
