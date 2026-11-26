import { createClient, type Client } from '@libsql/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, expect, test } from 'vitest';
import { readDatabaseEnv, runMigrations } from './migrate';
import { openMigratedDb, seedEveryTable } from './test-db';

// Banco em memória: sem arquivo para apagar (no Windows o libsql só solta o
// arquivo quando o processo termina). As regras das tabelas contra o banco
// ficam em constraints.test.ts (ATL-72).
const client = createClient({ url: ':memory:' });

afterAll(() => client.close());

// O down é escrito à mão e o drizzle não o conhece (D-064): o teste o roda.
const DOWN_0000 = readFileSync(
  fileURLToPath(new URL('../drizzle/0000_schema_v1.down.sql', import.meta.url)),
  'utf8',
);

async function tableNames(db: Client = client) {
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return result.rows.map((row) => String(row['name']));
}

// Banco com uma linha em cada tabela e o down da 0000 já rodado.
async function seededThenDown() {
  const db = await openMigratedDb();
  await seedEveryTable(db);
  for (const table of await tableNames(db)) {
    if (table === '__drizzle_migrations') continue;
    const { rows } = await db.execute(`SELECT count(*) AS n FROM "${table}"`);
    expect(rows[0], `linha em ${table}`).toMatchObject({ n: table === 'skills' ? 2 : 1 });
  }
  await db.executeMultiple(DOWN_0000);
  return db;
}

// As 15 tabelas do MVP mais o registro do migrator, em ordem alfabética.
const EXPECTED_TABLES = [
  '__drizzle_migrations',
  'explanation_grades',
  'imports',
  'items',
  'material_skills',
  'materials',
  'memory_states',
  'plan_items',
  'plans',
  'programs',
  'proofs',
  'review_logs',
  'settings',
  'skill_prereqs',
  'skills',
  'subjects',
];

test('a 0000 cria as 15 tabelas do MVP, sem notes nem availability', async () => {
  await runMigrations(client);
  expect(await tableNames()).toEqual(EXPECTED_TABLES);
});

test('aplicar de novo não muda nada', async () => {
  const before = await tableNames();
  await runMigrations(client);
  expect(await tableNames()).toEqual(before);
});

test('a chave estrangeira continua ligada depois da migration', async () => {
  const db = await openMigratedDb();
  try {
    const { rows } = await db.execute('PRAGMA foreign_keys');
    expect(rows[0]).toMatchObject({ foreign_keys: 1 });
  } finally {
    db.close();
  }
});

test('o down da 0000, com dados em todas as tabelas, deixa o banco vazio', async () => {
  const db = await seededThenDown();
  try {
    // Nada sobra: nem tabela, nem índice, nem o registro do migrator.
    const { rows } = await db.execute('SELECT type, name FROM sqlite_master');
    expect(rows.map((row) => `${String(row['type'])} ${String(row['name'])}`)).toEqual([]);
  } finally {
    db.close();
  }
});

test('depois do down, a 0000 se aplica de novo e as tabelas voltam vazias', async () => {
  const db = await seededThenDown();
  try {
    await runMigrations(db);
    const tables = await tableNames(db);
    expect(tables).toEqual(EXPECTED_TABLES);
    for (const table of tables) {
      if (table === '__drizzle_migrations') continue;
      const { rows } = await db.execute(`SELECT count(*) AS n FROM "${table}"`);
      expect(rows[0], `tabela ${table}`).toMatchObject({ n: 0 });
    }
  } finally {
    db.close();
  }
});

test('readDatabaseEnv exige DATABASE_URL e só passa o token quando há um', () => {
  expect(() => readDatabaseEnv({})).toThrow('DATABASE_URL');
  expect(() => readDatabaseEnv({ DATABASE_URL: '' })).toThrow('DATABASE_URL');
  expect(readDatabaseEnv({ DATABASE_URL: 'file:a.db', DATABASE_AUTH_TOKEN: '' })).toEqual({
    url: 'file:a.db',
  });
  expect(readDatabaseEnv({ DATABASE_URL: 'libsql://x', DATABASE_AUTH_TOKEN: 't' })).toEqual({
    url: 'libsql://x',
    authToken: 't',
  });
});
