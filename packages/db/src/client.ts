import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export type Db = Awaited<ReturnType<typeof createDb>>;

// Abre o banco: `file:` no PC, no CI e no Docker; URL do Turso em produção
// (D-036). Quem lê DATABASE_URL é a borda (app ou comando), não este pacote.
export async function createDb(url: string, authToken?: string) {
  const client = createClient(authToken === undefined ? { url } : { url, authToken });
  // O SQLite não liga chave estrangeira por padrão (docs/04-dados.md). O libsql
  // já liga em toda conexão nova do pool; o PRAGMA explícito garante o mesmo
  // se isso mudar. O teste confere numa conexão nova, não só nesta.
  await client.execute('PRAGMA foreign_keys = ON');
  return drizzle(client, { schema });
}
