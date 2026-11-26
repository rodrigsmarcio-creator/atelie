// Porta de entrada do conteúdo (docs/09-schema-importacao.md): o que a rota
// /api/import e o seed reaproveitam. O comando (`cli.ts`) fica de fora: lê
// arquivo e variável de ambiente.
export { checkImportFile, type CheckIssue, type CheckResult } from './check';
export { runImport, type RunContext, type RunResult, type RunSummary } from './run';
export {
  parseImportFile,
  type ImportIssue,
  type ParseResult,
  type ParsedImportFile,
} from './schema';
export { validateImportFile } from './validate';
