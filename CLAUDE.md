# CLAUDE.md — Ateliê

Instruções para o Claude Code neste repositório. Leia inteiro antes da primeira
tarefa. Os documentos em `docs/` são a fonte de verdade; este arquivo só diz
como trabalhar.

## O que é o Ateliê

Sistema pessoal de estudos do Márcio. Uso individual, acessado pelo navegador
do PC e do celular. Três partes:

- **Gregor** (`packages/core`): motor determinístico que decide o que estudar
  agora, calcula domínio, ofensiva e XP. Regras, não IA.
- **Jane**: o Claude. Gera conteúdo (Ofícios, questões, cartões), explica,
  corrige. Fora do app na v1: Claude Code gera JSON, o app importa.
- **App** (`packages/db`, `apps/web`): estado, telas, importação, Google Agenda.

Conceito completo em `docs/00-contexto.md`. Vocabulário em `docs/07-glossario.md`.
Use os nomes do glossário no código, nos comentários e no chat.

## Leia antes de mexer

| Tarefa | Leia |
|---|---|
| Qualquer coisa em `packages/core` | `docs/03-gregor.md`, depois `docs/02-ciencia.md` |
| Schema, migration, consulta | `docs/04-dados.md` |
| Gerar matéria, questões, cartões | `docs/09-schema-importacao.md` |
| Tela nova ou mudança de UI | `docs/05-atelie.md` e `docs/01-arquitetura.md` |
| Decisão de produto ou técnica | `docs/06-decisoes.md` |
| Ticket, branch, commit, PR, CI | `docs/11-esteira.md` |

As skills `atelie-gregor`, `atelie-dados`, `atelie-conteudo` e `atelie-web`
repetem as regras críticas de cada área. Quando uma skill e um doc divergirem,
avise e pare.

## Jira e Git (esteira rígida, detalhes em `docs/11-esteira.md`)

- Todo trabalho nasce de um ticket do Jira (chave `ATL`). Uma sessão por
  ticket. O ticket traz critérios de aceite, os docs a ler e o modelo sugerido.
- Uma branch por subtarefa: `ATL-<n>-descricao-curta`. Commit em português
  começando por `ATL-<n>`. PR com título `ATL-<n> Título`.
- Nunca commitar na `main`. Nunca fazer push, merge nem marcar um ticket como
  Concluído sem o Márcio mandar. O Claude move os status pelo conector da
  Atlassian: A fazer → Em andamento → Em análise; Concluído só depois do merge
  confirmado.
- PR só com CI, Testes e SonarCloud verdes. Explique o PR em português simples
  para o Márcio aprovar.

## Como trabalhar

1. **Leia só o que a tarefa pede.** Não varra o repositório. Releia um arquivo
   apenas se ele mudou.
2. **Questione antes de executar.** Se a ordem tem risco, alternativa melhor ou
   contradiz `docs/06-decisoes.md`, diga em 1 a 3 linhas e então siga (ou pare,
   se for contradição).
3. **Plano curto no chat antes de mudança não trivial.** Passos pequenos e
   verificáveis. Diga como testar. Não entregue só um `.md`.
4. **Diff mínimo.** Não reescreva arquivo inteiro, não altere o que não foi
   pedido, não remova comentário ou código existente sem pedido explícito. Se
   achar código morto, avise e pergunte.
5. **Dependência nova só com aviso** e justificativa de uma linha.
6. **Ao terminar:** liste arquivos alterados e o motivo de cada um. Apague os
   temporários que você criou. Não crie `_old`, `_v2`, `.bak` ou `backup/`: o
   histórico é o Git.
7. **Registre decisões.** Toda escolha que afeta produto ou arquitetura ganha
   uma linha em `docs/06-decisoes.md` no mesmo commit.

## Código

- TypeScript estrito em tudo. `strict: true`, sem `any` implícito, sem `!` de
  não-nulo fora de teste.
- Simples antes de abstrato. Sem redundância, sem abstração para caso
  hipotético.
- ESLint e Prettier do repositório mandam. Não discuta estilo no PR.
- Erros tratados nas bordas (input, rede, banco). Sem `try/catch` que engole.
- Validação de entrada com Zod nas bordas; constraints no banco também
  (`docs/04-dados.md`).
- Dinheiro não existe neste projeto. Tempo é inteiro em minutos; datas são
  ISO 8601 em UTC no banco, convertidas na borda. O "dia" do usuário é o
  calendário do fuso `America/Sao_Paulo` (configuração).
- Comentário onde a intenção não é óbvia, em português. Nomes de código em
  inglês; nomes de domínio (Ofício, Gregor) conforme o glossário.

## `packages/core` é puro

Sem `Date.now()`, sem `Math.random()`, sem I/O, sem importar `db` ou `web`.
Data ("agora"), fuso e aleatoriedade entram como parâmetro. Toda decisão
devolve `reason`. Todo número de decisão fica em `params.ts` com comentário de
origem (hipótese ou evidência). Detalhes em `docs/03-gregor.md`.

## Frontend

- Tailwind. Sem CSS solto fora de `globals.css`.
- **Três paletas escuras trocáveis** (E, G, H em `docs/05-atelie.md`). Todo
  componente usa só tokens semânticos (`bg`, `surface`, `text`, `accent`...),
  nunca cor solta. Só modo escuro. Mobile-first, mas o uso principal é no PC.
- Padrões obrigatórios: **sidebar dupla** (rail de seções + menu contextual da
  seção; o menu some quando a seção tem um item só) e **regra dos 3 cliques**
  (qualquer ação principal a no máximo 3 cliques a partir do Painel).
- Toda tela com dados tem estados de carregamento, vazio, erro e sucesso.
- Acessibilidade mínima WCAG 2.2 AA: HTML semântico, contraste 4,5:1 em **cada
  uma das três paletas** (há teste automático), alvos de toque ≥ 24px (ideal
  44px), foco visível, tudo operável por teclado, `prefers-reduced-motion`
  desliga brilhos e animações.
- Revelação progressiva: opções avançadas escondidas, no máximo 2 níveis.

## Backend e dados

- Contratos claros: validação de entrada, erros em formato consistente,
  paginação em toda coleção que cresce.
- Idempotência na importação (chave por ULID).
- Migrations versionadas e reversíveis. `review_logs` é append-only.
- Operações de vários passos em transação.
- Segredos (Google, chaves) e dados reais (banco, PDFs, conteúdo) ficam fora
  do Git, porque o repositório é público (D-034).

## Comandos

Existem a partir do épico de fundação (ver `docs/08-roadmap.md`).

```
pnpm install
pnpm dev                 # apps/web em http://localhost:3000
pnpm test                # vitest em todos os pacotes
pnpm lint                # eslint + prettier --check
pnpm db:migrate          # aplica migrations
pnpm db:seed             # cenário de desenvolvimento
pnpm memory:rebuild      # reconstrói memory_states a partir de review_logs
pnpm import:validate <arquivo.json>
pnpm import:run <arquivo.json>
```

## Modelo recomendado por tipo de tarefa

- **Opus**: `packages/core` (Gregor), schema e migrations, arquitetura, bugs
  difíceis, geração de conteúdo pela Jane.
- **Sonnet**: telas, CRUD, importação, esteira (CI, Sonar, Docker), Google
  Agenda (OAuth: se travar, subir para Opus), revisão de PR (em PR de Gregor
  ou de banco, Opus).
- **Haiku**: seeds, fixtures, renomeações mecânicas, formatar docs, criar
  tickets em lote, converter anotações em JSON de questões.
- Fable: só para decisão grande de arquitetura no meio do caminho.

O ticket traz o campo "Modelo sugerido"; o Márcio troca o modelo antes de
abrir a sessão.

## O que não fazer

- Não colocar o Claude dentro do Gregor. A Jane gera conteúdo; o Gregor decide
  agenda. Essa separação está em `docs/06-decisoes.md` (D-003).
- Não implementar FSRS à mão. Biblioteca (`ts-fsrs`), atrás de um adaptador.
- Não gravar dado real do usuário em seed.
- Não escrever UPDATE/DELETE em `review_logs`.
- Não simplificar de novo o domínio por 5 dimensões nem a confiança sem uma
  decisão nova (D-022).
- Não dar XP por tentativa errada nem por leitura; não perder prova conquistada
  (o decaimento é a revisão, não a perda de prova).
