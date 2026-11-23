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
- **Ao iniciar um ticket**, o Claude, antes de qualquer outra coisa: (1) põe o
  Márcio como **responsável** do ticket; (2) move o ticket para **Em andamento**;
  (3) move para **Em andamento** também a **história** e o **épico** acima dele,
  se ainda estiverem em A fazer. Exemplo: ao começar uma subtarefa do épico
  Ficha, a subtarefa, a história dela e o épico Ficha ficam Em andamento, e a
  subtarefa fica com o Márcio. Épico e história concluídos só depois que todos
  os filhos estiverem Concluídos.

## Git

- Repositório **público** no GitHub (D-034). Por ser público, ficam fora do Git:
  banco, PDFs, segredos e conteúdo real (`.gitignore`).
- **Uma branch por subtarefa:** `ATL-<n>-descricao-curta`.
- **Commit** em português, começando por `ATL-<n>`.
- **PR** com título `ATL-<n> Título`. Nunca commitar direto na `main`.
- **Uma sessão por ticket.** A sessão abre com o ticket, os critérios de aceite
  e os docs a ler.
- O Claude **nunca** faz push, merge nem marca Concluído sem o Márcio mandar.

## Pull request e checks

- Checks obrigatórios: **CI** e **Testes** (D-032, D-034). O SonarCloud roda no
  PR, mas ainda não é check obrigatório. O autor não aprova o próprio PR no
  GitHub, então a regra é "checks obrigatórios", não "aprovação obrigatória".
- O Claude explica o PR em português simples (o que mudou, por que, como
  testar). O Márcio aprova e faz o merge.

## Proteção da `main`

Ruleset **`main protegida`** no GitHub (*Settings → Rules → Rulesets*), criado
no ATL-64 e ativo na branch padrão (D-034):

- Só entra por PR; push direto na `main` é recusado.
- Checks obrigatórios: `CI` e `Testes` (nomes dos **jobs** do `ci.yml`; renomear
  um job sem atualizar o ruleset trava todos os PRs).
- Sem exigir aprovação e sem exigir a branch atualizada com a `main`.
- Sem force-push e sem apagar a `main`.
- **Sem exceção**: nem o administrador fura. Em emergência (por exemplo, o
  GitHub Actions fora do ar), o Márcio desliga o ruleset em *Settings → Rules*,
  resolve e liga de novo, registrando o motivo no ticket.

Para conferir o estado atual:

```
gh api repos/rodrigsmarcio-creator/atelie/rulesets
```

Para recriar (por exemplo, se o repositório for copiado):

```
gh api -X POST repos/rodrigsmarcio-creator/atelie/rulesets --input - <<'JSON'
{
  "name": "main protegida",
  "target": "branch",
  "enforcement": "active",
  "bypass_actors": [],
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "rules": [
    { "type": "pull_request", "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false } },
    { "type": "required_status_checks", "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [ { "context": "CI" }, { "context": "Testes" } ] } },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
JSON
```

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
- O repositório é público (D-034), então o plano gratuito não tem o limite de
  linhas que vale para repositório privado (confirmar as condições ao criar a
  conta).

## Docker

Só nos **testes do PR**. No dia a dia, `pnpm dev`. Deploy gratuito no MVP (D-035); o deploy automático é o ATL-29.

O job `Testes` constrói o `Dockerfile.test` (Node 24 fixado por tag e digest,
pnpm pelo `corepack`, usuário `node`) e roda `pnpm test` dentro dele. O
`coverage/lcov.info` sai do container com `docker cp` e sobe como artefato
`coverage-lcov` (o Vitest só gera o arquivo se os testes passam; ele sobe mesmo
quando o job falha só pelo limite de cobertura). Para rodar igual na máquina (com o
Docker aberto), na raiz do repositório:

```
docker build -f Dockerfile.test -t atelie-test .
docker run --name atelie-test atelie-test
docker cp atelie-test:/app/coverage/lcov.info coverage/lcov.info
docker rm atelie-test
```

O dia a dia segue `pnpm test`. Para atualizar a imagem base, troque a tag e o
digest juntos no `Dockerfile.test`.

## Registro de mudanças

Mudanças de produto ou arquitetura entram em `docs/06-decisoes.md` no mesmo
commit. O histórico de código é o Git; não criar `_old`, `_v2` ou `.bak`.

## Referências do Zappi

Arquivos de onde copiar (ficam fora do repositório): o `ci.yml` do GitHub
Actions, a seção de regras de Jira e Git do `context.md` e a lista de
ferramentas do PDF `ferramentas-zappi`. Não copiar um `context.md` gigante lido
inteiro a cada sessão: aqui o contexto é `CLAUDE.md` + os docs que o ticket
indica.
