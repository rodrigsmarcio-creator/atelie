import { sql } from 'drizzle-orm';
import { check, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';

// Acervo da Biblioteca (docs/04-dados.md). `path` é o nome do arquivo relativo
// a data/acervo/ e serve de chave do material citado por nome (D-049, D-056);
// o arquivo em si só existe no PC. `body` guarda o texto da nota e o do `.md`
// enviado pela tela (D-036); citado por nome, o `.md` fica sem `body` (D-063).
// O UNIQUE não colide em NULL no SQLite, então só vale onde há valor.
export const materials = sqliteTable(
  'materials',
  {
    id: text('id').primaryKey(),
    kind: text('kind', {
      enum: ['pdf', 'video', 'link', 'nota', 'livro', 'markdown'],
    }).notNull(),
    title: text('title').notNull(),
    author: text('author'),
    path: text('path').unique(),
    url: text('url').unique(),
    body: text('body'),
    pages: integer('pages'),
    // Informativo: não entra em domínio.
    progress: real('progress').notNull().default(0),
    // Capa, glifo, capítulo atual; as chaves se definem no ticket da Biblioteca.
    metaJson: text('meta_json', { mode: 'json' }).$type<Record<string, unknown>>(),
    ...timestamps(),
  },
  () => [
    check('materials_kind_enum', sql`kind IN ('pdf','video','link','nota','livro','markdown')`),
    check('materials_path_by_kind', sql`(path IS NOT NULL) = (kind IN ('pdf','markdown'))`),
    check('materials_url_by_kind', sql`(url IS NOT NULL) = (kind IN ('video','link'))`),
    check('materials_body_by_kind', sql`body IS NULL OR kind IN ('nota','markdown')`),
    check('materials_body_required_nota', sql`kind <> 'nota' OR body IS NOT NULL`),
    check('materials_pages_min', sql`pages IS NULL OR pages >= 1`),
    check('materials_progress_range', sql`progress BETWEEN 0 AND 1`),
    check('materials_meta_json_valid', sql`meta_json IS NULL OR json_valid(meta_json)`),
  ],
);
