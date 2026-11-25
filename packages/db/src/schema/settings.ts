import { sql } from 'drizzle-orm';
import { check, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { timestamps } from './columns';

// Configurações em chave-valor (docs/04-dados.md): um usuário só, sem tabela
// users. As chaves (`fuso_horario`, `tema`) e seus padrões são validados pelo
// Zod na borda; ficam abertas no banco porque o Google Agenda vai somar outras
// (A-007). Dado de conexão do Google nunca vai para o Git.
export const settings = sqliteTable(
  'settings',
  {
    key: text('key').primaryKey(),
    valueJson: text('value_json', { mode: 'json' }).notNull(),
    ...timestamps(),
  },
  () => [check('settings_value_json_valid', sql`json_valid(value_json)`)],
);
