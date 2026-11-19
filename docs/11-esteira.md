# 11 · Esteira de desenvolvimento

Como o trabalho anda, do ticket ao merge. A esteira é seguida de forma **rígida,
sempre**. A única exceção é o primeiro commit (ATL-59), feito direto na `main`,
sem PR, porque o repositório ainda não existe e não há CI. O push dele só sai
com ordem do Márcio.
Base: o processo do projeto Zappi (referência de processo, não de produto).

Ordem do projeto: alinhar ideias → montar a esteira → criar o roadmap no Jira
→ desenvolver ticket a ticket. Estado em `docs/08-roadmap.md`, épico 0.

## Jira

- Chave `ATL`. Hierarquia: **Épico → História → Subtarefa**.
- Toda história tem **critérios de aceite**, a lista de **docs a ler** e o
  **modelo sugerido** (`CLAUDE.md`).
- Subtarefas com prefixo: `[Dados]`, `[Gregor]`, `[Web]`, `[Infra]`,
  `[Testes]`.
- Fluxo contínuo, sem sprints. Status: **A fazer → Em andamento → Em análise →
  Concluído**.
- O Claude move os status pelo conector da Atlassian (o Márcio autoriza o
  conector). Concluído **só depois do merge confirmado**.
- O plano dos épicos e histórias é aprovado pelo Márcio **antes** de criar
  qualquer ticket.

## Git

- Repositório **privado** no GitHub. Mesmo privado, ficam fora do Git: banco,
  PDFs, segredos e conteúdo real (`.gitignore`).
- **Uma branch por subtarefa:** `ATL-<n>-descricao-curta`.
- **Commit** em português, começando por `ATL-<n>`.
- **PR** com título `ATL-<n> Título`. Nunca commitar direto na `main`.
- **Uma sessão por ticket.** A sessão abre com o ticket, os critérios de aceite
  e os docs a ler.
- O Claude **nunca** faz push, merge nem marca Concluído sem o Márcio mandar.

## Pull request e checks

- Checks obrigatórios: **CI** e **SonarCloud**. O autor não aprova o próprio PR
  no GitHub, então a regra é "checks obrigatórios", não "aprovação
  obrigatória".
- O Claude explica o PR em português simples (o que mudou, por que, como
  testar). O Márcio aprova e faz o merge.

## CI (GitHub Actions)

Copiado do Zappi e adaptado depois:

- Roda em PR e em push na `main`.
- Ações fixadas por SHA; instalação com `--ignore-scripts`;
  `permissions: contents: read`; cancela rodadas antigas do mesmo PR.
- Jobs: lint, testes (Vitest, em Docker), build. Os checks se chamam **`CI`**
  (lint e build) e **`Testes`** (Docker); a proteção da `main` exige esses
  nomes (D-032).
- Cobertura mínima **por pasta** via Vitest: alta em `packages/core`, baixa ou
  nenhuma nas telas.
- Inclui o teste de contraste das três paletas (`docs/05-atelie.md`).

## SonarCloud

- Começa como no Zappi (análise automática, fora do repositório) e depois migra
  para análise pelo CI com cobertura. Antes da migração, desligar a análise
  automática.
- Plano gratuito cobre repositório privado até um limite de linhas (cerca de
  50 mil; confirmar as condições ao criar a conta).

## Docker

Só nos **testes do PR**. No dia a dia, `pnpm dev`. Sem deploy automático na v1.

## Registro de mudanças

Mudanças de produto ou arquitetura entram em `docs/06-decisoes.md` no mesmo
commit. O histórico de código é o Git; não criar `_old`, `_v2` ou `.bak`.

## Referências do Zappi

Arquivos de onde copiar (ficam fora do repositório): o `ci.yml` do GitHub
Actions, a seção de regras de Jira e Git do `context.md` e a lista de
ferramentas do PDF `ferramentas-zappi`. Não copiar um `context.md` gigante lido
inteiro a cada sessão: aqui o contexto é `CLAUDE.md` + os docs que o ticket
indica.
