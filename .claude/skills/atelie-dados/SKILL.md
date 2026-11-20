---
name: atelie-dados
description: Regras para mexer no banco do Ateliê — schema Drizzle, migrations, constraints, consultas e seeds. Use sempre que a tarefa envolver criar ou alterar tabela, adicionar coluna, escrever migration, mudar índice, escrever consulta SQL ou Drizzle, ou qualquer arquivo em packages/db. Use também quando o pedido for indireto, como "o Ateliê precisa guardar X" ou "falta um campo para Y", porque isso é mudança de schema mesmo sem a palavra banco aparecer.
---

# Banco do Ateliê

Referência do modelo: `docs/04-dados.md`. Leia antes de alterar schema. Nomes
de domínio em `docs/07-glossario.md`. O ticket do Jira (chave `ATL`) diz o
escopo; siga `docs/11-esteira.md`. Schema e migrations são trabalho para o
modelo Opus (`CLAUDE.md`).

## Restrições ficam no banco

PK, FK, UNIQUE, NOT NULL e CHECK vão no schema Drizzle e na migration, não só
na validação Zod. A aplicação vai ter bugs; o banco é a última linha. Um CHECK
que você considerou óbvio demais para escrever é exatamente o que vai salvar o
dado daqui a seis meses.

O banco é SQLite via libSQL (`@libsql/client` + `drizzle-orm/libsql`): arquivo
`file:` no PC, no CI e no Docker, Turso em produção (D-036). Não use
`better-sqlite3`. Em SQLite, `PRAGMA foreign_keys = ON` precisa ser ligado em
toda conexão; não é padrão. Ligue de forma explícita ao abrir o cliente e tenha
um teste que prove que uma FK inválida é recusada, tanto em `file:` quanto no
Turso.

## `review_logs` é append-only

Nunca escreva UPDATE ou DELETE nessa tabela. Se uma tarefa parece exigir isso,
ela está mal especificada: avise o usuário em vez de executar.

Motivo: é o registro bruto que permite recalibrar o FSRS e os parâmetros do
Gregor com dados reais, e é de onde saem a ofensiva e o XP. Perdeu o log,
perdeu a possibilidade de o sistema ficar bom.

## `memory_states` e `proofs` são cache

São derivadas de `review_logs`. Mantenha o comando `pnpm run memory:rebuild`
funcionando, que reconstrói as duas tabelas inteiras a partir dos logs usando
`core` (`evaluateProof` e o adaptador de memória). É o que torna seguro trocar
a versão do algoritmo depois. `proofs.kind` são as 5 dimensões: `conceitual`,
`fluencia`, `problemas`, `autonomia`, `explicacao` (D-022). Ofensiva, XP e nível
são **derivados** de `review_logs` e `proofs`: não crie tabela para eles sem
decisão nova.

Se você adicionar uma coluna em `memory_states` ou `proofs`, atualize o rebuild
na mesma mudança. Rebuild desatualizado é pior que inexistente, porque dá falsa
segurança.

## Importação é a única porta de conteúdo

`skills`, `skill_prereqs` e `items` só recebem escrita pela importação
(`db/src/import`, formato em `docs/09-schema-importacao.md`) ou pela API de
edição da UI. Nunca por INSERT solto, nem no seed: o seed usa a mesma função
de importação. A importação valida aciclicidade do grafo; o banco não consegue.

## Migrations

- Versionadas e reversíveis. Toda migration tem `up` e `down`.
- Uma migration por mudança lógica. Não junte três assuntos.
- Teste o `down` localmente antes de entregar. Reversão que não foi testada não
  é reversível.
- Nunca edite migration já aplicada. Crie outra.
- SQLite não altera coluna direto: a mudança vira criar tabela nova, copiar,
  apagar, renomear. O Drizzle Kit gera isso, mas confira o SQL. É a operação
  mais fácil de perder dado.
- Não crie tabela para feature de fora do MVP (`notes` e `availability` não
  existem no MVP; D-009 e D-021). Tabelas e colunas do Google Agenda e do FSRS
  são afinadas no ticket respectivo (A-007).

## Índices

Crie índice pensando na consulta, não por precaução. Os acessos previstos:

- Revisões vencidas: `memory_states(due_at)`.
- Itens de um Ofício: `items(skill_id)`.
- Histórico de um item: `review_logs(item_id, reviewed_at)`.
- Histórico de um Ofício: `review_logs(skill_id, reviewed_at)`.
- Sessão do dia: `plan_items(plan_id, scheduled_start)`.

Antes de adicionar índice novo, mostre a consulta que o justifica.

## Consultas

- Sempre parametrizadas. Nunca concatene valor em string SQL.
- Toda coleção que cresce tem paginação. `review_logs` chega a milhares de
  linhas no primeiro semestre.
- Operações de vários passos dentro de transação. Importar conteúdo, gerar
  plano e registrar prova (log + memória + prova) são transações inteiras: ou
  tudo, ou nada.
- Datas em ISO 8601 UTC no banco. Conversão de fuso só na borda.

## Seeds

O seed cria dado de desenvolvimento, nunca dado real do usuário. Mantenha um
seed que produza um cenário útil para teste: duas disciplinas, grafo com
pré-requisito, alguns itens já revisados e alguns vencidos, e uma ofensiva em
andamento. Sem isso, testar a Bancada exige estudar de verdade primeiro.

O mesmo cenário é exportado como `packages/core/test/fixtures/seed.json`, para
`core` e `db` testarem sobre o mesmo estado.

## Antes de encerrar

Liste: tabelas tocadas, constraints adicionadas, migration criada, se o
`down` foi testado, e se o rebuild precisou mudar.
