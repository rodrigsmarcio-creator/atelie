import { createClient } from '@libsql/client';
import { afterAll, expect, test } from 'vitest';
import { readDatabaseEnv, runMigrations } from './migrate';

// Banco em memória: sem arquivo para apagar (no Windows o libsql só solta o
// arquivo quando o processo termina). Reverter a 0000 e testar as regras
// contra o banco é do ATL-72; aqui só o critério do ATL-71.
const client = createClient({ url: ':memory:' });

afterAll(() => client.close());

async function tableNames() {
  const result = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  );
  return result.rows.map((row) => String(row['name']));
}

test('a 0000 cria as 15 tabelas do MVP, sem notes nem availability', async () => {
  await runMigrations(client);
  expect(await tableNames()).toEqual([
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
  ]);
});

test('aplicar de novo não muda nada', async () => {
  const before = await tableNames();
  await runMigrations(client);
  expect(await tableNames()).toEqual(before);
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
