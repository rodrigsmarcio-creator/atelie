import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterAll, afterEach, beforeEach, expect, test } from 'vitest';
import { createDb, type Db } from './client';

// Banco em arquivo temporário: `:memory:` teria uma conexão só e não
// mostraria o que acontece numa conexão nova do pool.
const dir = mkdtempSync(join(tmpdir(), 'atelie-db-'));
let fileCount = 0;
let db: Db;

beforeEach(async () => {
  fileCount += 1;
  db = await createDb(pathToFileURL(join(dir, `test-${fileCount}.db`)).href);
});

afterEach(() => {
  db.$client.close();
});

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch (error) {
    // No Windows o libsql só solta o arquivo quando o processo termina, mesmo
    // depois do close(); a pasta fica no temp do sistema. Fora isso, é erro.
    const code = (error as NodeJS.ErrnoException).code;
    if (!(process.platform === 'win32' && code === 'EPERM')) throw error;
  }
});

async function foreignKeysOn(run: (sql: string) => Promise<{ rows: unknown[] }>) {
  const { rows } = await run('PRAGMA foreign_keys');
  return rows[0];
}

test('liga as chaves estrangeiras ao abrir', async () => {
  expect(await foreignKeysOn((s) => db.$client.execute(s))).toMatchObject({ foreign_keys: 1 });
});

test('aceita o token do Turso junto da URL', async () => {
  // Em `file:` o token é ignorado; aqui só se confere que o caminho abre.
  const withToken = await createDb(pathToFileURL(join(dir, 'token.db')).href, 'token-de-teste');
  expect(await foreignKeysOn((s) => withToken.$client.execute(s))).toMatchObject({
    foreign_keys: 1,
  });
  withToken.$client.close();
});

test('recusa uma chave estrangeira inválida', async () => {
  await db.$client.execute('CREATE TABLE parent (id TEXT PRIMARY KEY)');
  await db.$client.execute('CREATE TABLE child (parent_id TEXT NOT NULL REFERENCES parent(id))');
  await expect(db.$client.execute("INSERT INTO child VALUES ('nao-existe')")).rejects.toThrow(
    /FOREIGN KEY/,
  );
});

test('a conexão nova do pool também tem as chaves estrangeiras ligadas', async () => {
  // A transação segura a primeira conexão; a consulta de fora abre outra.
  const tx = await db.$client.transaction('write');
  try {
    expect(await foreignKeysOn((s) => tx.execute(s))).toMatchObject({ foreign_keys: 1 });
    expect(await foreignKeysOn((s) => db.$client.execute(s))).toMatchObject({ foreign_keys: 1 });
  } finally {
    tx.close();
  }
});
