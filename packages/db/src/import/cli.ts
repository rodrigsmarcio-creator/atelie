import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { createDb, type Db } from '../client';
import { readDatabaseEnv } from '../migrate';
import type { CheckIssue } from './check';
import { runImport } from './run';
import { parseImportFile } from './schema';
import { validateImportFile } from './validate';

// `pnpm import:validate <arquivo>` e `pnpm import:run <arquivo>` (docs/09). O
// único código desta pasta que lê arquivo e variável de ambiente: a borda.

const USAGE =
  'Uso: pnpm import:validate <arquivo.json>  ou  pnpm import:run <arquivo.json>\n' +
  'Defina DATABASE_URL (ex.: file:./data/atelie.db); no Turso, também DATABASE_AUTH_TOKEN.';

export type CliDatabase = { db: Db; close: () => void };

export type CliIo = {
  env: Record<string, string | undefined>;
  out: (line: string) => void;
  err: (line: string) => void;
  // Os testes passam um banco já pronto; o comando abre o do ambiente.
  openDb?: () => Promise<CliDatabase>;
};

async function openFromEnv(env: CliIo['env']): Promise<CliDatabase> {
  const config = readDatabaseEnv(env);
  const db = await createDb(config.url, 'authToken' in config ? config.authToken : undefined);
  return { db, close: () => db.$client.close() };
}

const formatIssue = (label: string, issue: CheckIssue) =>
  `${label}  ${issue.path === '' ? '(arquivo)' : issue.path}: ${issue.message}`;

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Devolve o código de saída: 0 deu certo, 1 o arquivo ou o ambiente falhou, 2 uso errado.
export async function runCli(args: readonly string[], io: CliIo): Promise<number> {
  const [command, path, ...extra] = args;
  if ((command !== 'validate' && command !== 'run') || path === undefined || extra.length > 0) {
    io.err(USAGE);
    return 2;
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (error) {
    io.err(`Não consegui ler "${path}": ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    io.err(
      `O arquivo não é um JSON válido: ${error instanceof Error ? error.message : String(error)}`,
    );
    return 1;
  }

  const parsed = parseImportFile(raw);
  if (!parsed.ok) {
    for (const issue of parsed.errors) io.err(formatIssue('ERRO ', issue));
    io.err(`Arquivo recusado: ${plural(parsed.errors.length, 'erro', 'erros')}. Nada foi gravado.`);
    return 1;
  }

  let database: CliDatabase;
  try {
    database = await (io.openDb ?? (() => openFromEnv(io.env)))();
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return 1;
  }

  try {
    if (command === 'validate') {
      const result = await validateImportFile(database.db, parsed.file);
      for (const issue of result.errors) io.err(formatIssue('ERRO ', issue));
      for (const issue of result.warnings) io.out(formatIssue('AVISO', issue));
      if (result.errors.length > 0) {
        io.err(
          `Arquivo recusado: ${plural(result.errors.length, 'erro', 'erros')}, ${plural(result.warnings.length, 'aviso', 'avisos')}. Nada foi gravado.`,
        );
        return 1;
      }
      io.out(
        result.warnings.length === 0
          ? 'Arquivo válido, sem erros e sem avisos.'
          : `Arquivo válido, com ${plural(result.warnings.length, 'aviso', 'avisos')}.`,
      );
      return 0;
    }

    const result = await runImport(database.db, parsed.file, {
      fileName: basename(path),
      fileHash: createHash('sha256').update(bytes).digest('hex'),
    });
    if (!result.ok) {
      for (const issue of result.errors) io.err(formatIssue('ERRO ', issue));
      for (const issue of result.warnings) io.out(formatIssue('AVISO', issue));
      io.err(
        `Arquivo recusado: ${plural(result.errors.length, 'erro', 'erros')}. Nada foi gravado.`,
      );
      return 1;
    }
    const { summary } = result;
    for (const issue of summary.warnings) io.out(formatIssue('AVISO', issue));
    io.out(
      `Matéria "${summary.subject.name}": ${summary.subject.created ? 'nova' : 'já existia'}.`,
    );
    if (summary.program !== undefined) {
      io.out(
        `Curso "${summary.program.name}": ${summary.program.created ? 'novo' : 'atualizado'}.`,
      );
    }
    io.out(`Ofícios: ${summary.skills.inserted} novos, ${summary.skills.existing} já existiam.`);
    io.out(`Itens: ${summary.items.inserted} novos, ${summary.items.existing} já existiam.`);
    if (summary.materials.created > 0) {
      io.out(`Materiais: ${summary.materials.created} criados na Biblioteca.`);
    }
    io.out(`Importação ${summary.importId} registrada.`);
    return 0;
  } finally {
    database.close();
  }
}

if (import.meta.main) {
  process.exitCode = await runCli(process.argv.slice(2), {
    env: process.env,
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
}
