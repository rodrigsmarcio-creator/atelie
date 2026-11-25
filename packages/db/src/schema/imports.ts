import { sql } from 'drizzle-orm';
import { check, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Auditoria da importação (docs/04-dados.md, D-059): responde "de onde veio
// este item" e "de onde veio esta nota". Uma linha por execução, que não se
// altera: `ran_at` faz o papel de created_at, como `generated_at` em plans.
export const imports = sqliteTable(
  'imports',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['conteudo', 'notas_explicacao'] }).notNull(),
    fileName: text('file_name').notNull(),
    fileHash: text('file_hash').notNull(),
    ranAt: text('ran_at').notNull(),
    skillsInserted: integer('skills_inserted').notNull().default(0),
    itemsInserted: integer('items_inserted').notNull().default(0),
    gradesInserted: integer('grades_inserted').notNull().default(0),
    // Registros pulados por já existirem (idempotência por ULID).
    skipped: integer('skipped').notNull().default(0),
    errorsJson: text('errors_json', { mode: 'json' })
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'`),
  },
  () => [
    check('imports_kind_enum', sql`kind IN ('conteudo','notas_explicacao')`),
    check(
      'imports_counts_min',
      sql`skills_inserted >= 0 AND items_inserted >= 0 AND grades_inserted >= 0 AND skipped >= 0`,
    ),
    // Arquivo de conteúdo não traz notas; arquivo de notas não traz Ofício nem item.
    check(
      'imports_counts_by_kind',
      sql`(kind = 'conteudo' AND grades_inserted = 0) OR (kind = 'notas_explicacao' AND skills_inserted = 0 AND items_inserted = 0)`,
    ),
    check('imports_errors_json_valid', sql`json_valid(errors_json)`),
  ],
);
