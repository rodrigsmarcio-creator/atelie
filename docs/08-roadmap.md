# 08 · Roadmap

O trabalho é organizado em **épicos no Jira** (chave `ATL`), em fluxo contínuo,
sem sprints. Este documento é o mapa do MVP e a ordem sugerida; o Jira tem o
detalhe (histórias, critérios de aceite, subtarefas). Cada ticket traz o modelo
sugerido (ver `CLAUDE.md`). Processo rígido em `docs/11-esteira.md`.

Regra: depois do MVP, nenhuma fase nova começa sem o MVP em **uso real** por
pelo menos duas semanas.

## Ordem dos épicos do MVP

A ordem é uma sugestão; o plano final dos épicos e histórias é aprovado pelo
Márcio **antes** de criar qualquer ticket.

### 0 · Esteira e fundação — Sonnet (Opus no que for decisão de estrutura)

- Repositório Git privado, pnpm workspaces, TypeScript estrito, ESLint,
  Prettier, Vitest. Scripts do `CLAUDE.md` existindo (mesmo que vazios).
- CI no GitHub Actions copiado do Zappi; SonarCloud (análise automática
  primeiro; depois pelo CI com cobertura); testes em Docker no PR; cobertura
  por pasta.
- Jira `ATL` configurado, regras de branch/commit/PR, conector da Atlassian.
- Revisão final dos docs e das 4 skills contra o que foi construído.

**Pronto quando:** um PR de teste passa no CI e no SonarCloud, e o ticket muda
de status pelo Claude.

### 1 · Identidade visual e temas — Sonnet; Opus nas decisões de tokens

- Kit de tokens das três paletas (E, G, H), tipografia atrelada, ornamentos de
  E e G, componentes base.
- Protótipo HTML das telas-chave: Painel, prova, Ficha; no PC primeiro.
- Teste automático de contraste das três paletas.
- Aprovação do Márcio **antes** do front.

**Pronto quando:** o Márcio aprova o protótipo e o teste de contraste passa.

### 2 · Dados e importação — Opus no schema, Sonnet no resto

- Schema v1 de `docs/04-dados.md` em Drizzle, migration `0000`, `down` testado.
  `PRAGMA foreign_keys = ON` confirmado.
- Importação: Zod do `docs/09-schema-importacao.md`, `import:validate`,
  `import:run` idempotente, transação, tabela `imports`.
- Seed de desenvolvimento e fixture compartilhado com `core`.
- `memory:rebuild` funcionando.

**Pronto quando:** `pnpm db:migrate && pnpm db:seed && pnpm import:run
imports/<arquivo>.json` roda duas vezes sem duplicar.

Risco: ficar "ajustando o schema" por semanas. Fecha o schema v1 e depois é
migration.

### 3 · Gregor — Opus

- `packages/core`: `mastery` (5 dimensões, confiança, estados), `isUnlocked`,
  adaptador FSRS, `needsReview`, `planSession` (4 blocos, Completa e Curta),
  `streak`, `xpOf` e `level`, `evaluateProof`, `params.ts`.
- Testes obrigatórios de `docs/03-gregor.md`, seção 11. Cobertura alta.
- Resolver A-006 (prova Compreensão conceitual) e A-008 (valores iniciais).

**Pronto quando:** os testes passam e cada decisão do Gregor sai com `reason` e
`breakdown`.

### 4 · Painel e Praticar (primeiro ciclo completo) — Sonnet; Opus na rota de prova

- Rotas: `/api/session` (db → core → db), `/api/review` (transação: log,
  memória, prova), `/api/skills`, `/api/items`.
- Painel: sessão do dia com motivo, Completa/Curta, botão Começar, ofensiva,
  nível e XP, revisões vencidas, mini evolução.
- Praticar: fila de hoje (as 5 provas, modal de prova com as regras C-05 a
  C-10) e Cartões (Errei/Difícil/Bom/Fácil).
- Rail + sidebar dupla (some quando a aba tem um item só). Estados de
  carregamento, vazio, erro em todas as telas. Troca de paleta.

**Pronto quando:** abrir no celular ou no PC, clicar Começar, fazer uma prova,
ver a prova acender, o XP subir, a ofensiva contar e a próxima revisão
agendada. Usar por duas semanas.

### 5 · Biblioteca — Sonnet

- `materials` + `material_skills`; tela Materiais; tela Importar (`.json` pelo
  validador, `.md` guardado até a Jane converter) com as instruções do fluxo.

**Pronto quando:** um `.json` real da Jane entra pela tela, e um `.md` fica
guardado e ligado a um Ofício.

### 6 · Ficha — Sonnet; Opus no estado e na revisão do Ofício

- Resumo: nível, XP, ofensiva, domínio por matéria.
- Árvore SVG simples (leque, nós com os estados, cinco satélites de dimensão,
  arestas, marcador "precisa revisar", painel de detalhe). Resolver A-001.

**Pronto quando:** a Árvore mostra o estado real do banco.

### 7 · Planejar e Google Agenda — Sonnet; Opus se o OAuth travar

- Ticket de teste primeiro (A-007: validade do acesso, onde guardar o
  segredo).
- "Conectar Google Agenda" em configuração. Grade da semana com os eventos
  do Google. O Márcio escolhe a sessão e o horário; o app cria **um** evento
  com os blocos na descrição.

**Pronto quando:** uma sessão do dia aparece como evento na agenda real.

## Depois do MVP (candidatos)

- Extração de PDF e de link (API de extração), leitor de PDF, tela Livros.
- Sessão em etapas com relógio por bloco, captura rápida.
- Evolução (linha do tempo), Conquistas, caderno de erros, simulados.
- Prazo de prova e plano da semana no Gregor; proteção de ofensiva; benefícios
  por nível.
- Chat embutido da Jane e correção de redação.
- Recalibração de parâmetros a partir de `review_logs`.
- Serviço do Windows, backup automático do `atelie.db`, deploy.

## O que mede sucesso

Não é feature entregue. É:

1. Dias com ao menos uma tentativa nas últimas 4 semanas (meta: 5 de 7).
2. Tempo entre abrir o app e a primeira resposta registrada (meta: < 60 s).
3. Ofícios dominados por mês.
4. Quantas vezes a sessão sugerida pelo Gregor foi ignorada (se for muitas, as
   regras estão erradas, não o usuário).
