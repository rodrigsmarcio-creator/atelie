import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { fileURLToPath } from 'node:url';

// Aplica as migrations de packages/db/drizzle (D-064). Mesmo @libsql/client do
// app: `file:` no PC, no CI e no Docker, URL do Turso em produção (D-036).
// Roda direto no Node 24, sem compilar; por isso só importa pacotes, nunca
// arquivo do próprio repositório sem extensão.
const MIGRATIONS_FOLDER = fileURLToPath(new URL('../drizzle', import.meta.url));

// Quem abre e fecha o cliente é quem chama (o comando abaixo ou o teste).
export async function runMigrations(client: Client) {
  await migrate(drizzle(client), { migrationsFolder: MIGRATIONS_FOLDER });
}

// Borda: lê o destino das variáveis de ambiente. O token só existe no Turso.
export function readDatabaseEnv(env: Record<string, string | undefined>) {
  const url = env['DATABASE_URL'];
  if (url === undefined || url === '') {
    throw new Error('Defina DATABASE_URL (ex.: file:./data/atelie.db).');
  }
  const authToken = env['DATABASE_AUTH_TOKEN'];
  return authToken === undefined || authToken === '' ? { url } : { url, authToken };
}

// `pnpm db:migrate`.
if (import.meta.main) {
  const client = createClient(readDatabaseEnv(process.env));
  try {
    await runMigrations(client);
  } finally {
    client.close();
  }
  console.log('Migrations aplicadas.');
}
