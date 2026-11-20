# 01 · Arquitetura

Como o Ateliê é construído: linguagens, pacotes, fronteiras e ordem de
construção. Toda escolha aqui tem uma linha correspondente em
`docs/06-decisoes.md`.

## Visão geral

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web  (Next.js + React + Tailwind)                      │
│  telas · route handlers (/api) · importação · Google Agenda  │
└──────────────┬──────────────────────────────┬───────────────┘
               │ chama                        │ chama
┌──────────────▼───────────┐     ┌────────────▼───────────────┐
│  packages/core (Gregor)  │     │  packages/db (Drizzle)     │
│  puro · sem I/O          │     │  SQLite · migrations · seed │
│  domínio · sessão · FSRS │◄────┤  monta o estado e entrega  │
│  ofensiva · XP           │     │  ao core; grava o resultado │
└──────────────────────────┘     └────────────────────────────┘
               ▲
               │ JSON validado (Zod)
┌──────────────┴──────────────────────────────────────────────┐
│  Jane (Claude Code + skill atelie-conteudo), fora do app     │
│  gera imports/<materia>-<data>.json                          │
└──────────────────────────────────────────────────────────────┘
```

Fluxo de conteúdo completo (D-028): link ou PDF → API de extração → markdown →
Jane → JSON → validador → banco → Gregor. No MVP a extração fica de fora: a
Biblioteca recebe o `.json` pronto ou o `.md` (guardado até a Jane converter).
O Gregor só enxerga dado estruturado já no banco.

Regra de dependência: `web → db → core`. `core` não importa ninguém. `db` não
importa `web`. Se uma tarefa precisar inverter isso, a tarefa está errada.

## Stack

| Camada | Escolha | Por quê | Alternativa descartada |
|---|---|---|---|
| Linguagem | TypeScript estrito em tudo | Um só tipo do banco à tela; `core` compartilha tipos com `web` | Python no motor (duas linguagens, dois toolings) |
| Monorepo | pnpm workspaces | `core` isolado e testável; skills já assumem `packages/*` | App único com pastas (menos tooling, mas `core` acaba importando I/O "só desta vez") |
| Banco | SQLite via `better-sqlite3` | Um usuário, um arquivo, backup = copiar; sem serviço rodando | Postgres (peso morto para uso pessoal) |
| ORM | Drizzle + drizzle-kit | Schema em TS, migrations SQL legíveis, constraints no banco | Prisma (migrations opacas em SQLite) |
| Validação | Zod | Mesmo schema valida import, API e formulários | — |
| Web | Next.js (App Router) + React | Server e client num processo; route handlers servem de API; um `pnpm dev` | Vite + Hono separados (mais limpo, mais processos para manter) |
| Estilo | Tailwind + tokens por tema | Três paletas trocadas por `data-theme`, sem tocar nos componentes | CSS por paleta; cor solta em componente |
| Revisão espaçada | `ts-fsrs` atrás de `core/src/memory/fsrs-adapter.ts`, desde o MVP | Algoritmo publicado, mantido, baseado na curva do esquecimento; não se reimplementa | SM-2 à mão; intervalos fixos |
| Agenda | Google Calendar API (gratuita), ler eventos e criar evento | Planejar usa a agenda real do Márcio | Calendário próprio |
| IDs | ULID | Ordenável por tempo, gerado no cliente, chave de idempotência do import | UUID v4 (não ordena) |
| Testes | Vitest | Rápido, roda nos três pacotes; cobertura por pasta | — |
| Lint | ESLint + Prettier | Config única na raiz | — |
| CI | GitHub Actions + SonarCloud + Docker nos testes | Esteira rígida (`docs/11-esteira.md`) | — |

Versões: fixar no `package.json` com `~` (patch) e atualizar de propósito.

## Estrutura de pastas

```
atelie/
├── CLAUDE.md
├── docs/                      # estes documentos (docs/historico: só leitura)
├── imports/                   # JSON gerado pela Jane (versionado)
├── .claude/skills/            # atelie-gregor, -dados, -conteudo, -web
├── packages/
│   ├── core/                  # Gregor
│   │   ├── src/
│   │   │   ├── params.ts      # todo número de decisão, com origem
│   │   │   ├── types.ts       # estado de entrada e sessão de saída
│   │   │   ├── mastery/       # domínio (5 dimensões) e confiança por Ofício
│   │   │   ├── graph/         # pré-requisitos, desbloqueio, ciclos
│   │   │   ├── memory/        # fsrs-adapter.ts, revisão do Ofício
│   │   │   ├── planner/       # ordenação e sessão do dia (4 blocos)
│   │   │   ├── streak/        # ofensiva
│   │   │   ├── xp/            # XP e nível
│   │   │   └── index.ts
│   │   └── test/
│   └── db/
│       ├── src/
│       │   ├── schema/        # um arquivo por tabela
│       │   ├── migrations/    # gerado pelo drizzle-kit, revisado à mão
│       │   ├── queries/       # consultas nomeadas, parametrizadas
│       │   ├── import/        # validação Zod + importação idempotente
│       │   ├── seed.ts
│       │   └── rebuild-memory.ts
│       └── test/
└── apps/
    └── web/
        ├── app/
        │   ├── (secoes)/painel | planejar | biblioteca | praticar | ficha
        │   └── api/           # route handlers: sessão, prova, import, agenda
        ├── components/        # rail, menu, cartões, árvore (SVG), prova, ui
        ├── lib/               # cliente de API tipado, formatação, temas
        └── globals.css        # tokens das 3 paletas (data-theme)
```

## Fronteiras e contratos

### `core` recebe um snapshot, devolve a sessão

```ts
// packages/core/src/types.ts (resumo; completo em docs/03-gregor.md)
export interface StateSnapshot {
  now: string;                 // ISO, UTC. Nunca Date.now() dentro do core.
  timezone: string;            // "America/Sao_Paulo"
  skills: SkillState[];        // Ofícios com provas, erros e pré-requisitos
  memory: MemoryItem[];        // itens com due_at e estado FSRS
  subjects: SubjectState[];    // matéria e peso
  attempts: Attempt[];         // todas as tentativas (ofensiva e XP)
}
export interface DaySession {
  generatedAt: string;
  mode: 'completa' | 'curta';
  blocks: SessionBlock[];      // 4 blocos; cada item com reason: string[]
  params: Record<string, number | boolean | string>; // auditoria
}
```

`db` monta o `StateSnapshot` a partir das tabelas e grava a `DaySession` em
`plans`/`plan_items`. `web` nunca chama `core` direto para decidir; chama a
rota `/api/session`, que faz `db → core → db`.

### Importação: a única porta de entrada de conteúdo

`imports/*.json` (ou o arquivo enviado pela tela Importar) → `pnpm
import:validate` (Zod) → `pnpm import:run` (transação, idempotente por ULID).
Nenhum INSERT de conteúdo fora disso. O schema está em
`docs/09-schema-importacao.md`.

### Registro de prova: a única porta de entrada de evidência

`POST /api/review` grava em `review_logs` (append-only) e atualiza
`memory_states` e o domínio do Ofício na mesma transação. Toda prova, cartão
ou tentativa passa por aqui. Sem isso, domínio, XP e ofensiva não mudam.

### Google Agenda

Rota em `apps/web/app/api/agenda`, só no servidor. "Conectar Google Agenda" é
feito uma vez, em configuração (não é login do app); o servidor guarda o acesso
fora do Git. Lê os eventos da semana e cria **um** evento por sessão do dia.
Riscos a validar num ticket de teste: validade do acesso em modo teste do
Google, onde guardar o segredo (A-007).

## Dados em disco

- `data/atelie.db` (SQLite). Backup: copiar o arquivo com o app parado, ou
  `VACUUM INTO` com ele rodando.
- `data/acervo/` para arquivos (`.md`, PDFs) e anexos, referenciados por
  caminho relativo na tabela `materials`. Nunca dentro do banco.
- `imports/` versionado no Git: é o histórico do conteúdo gerado. Conteúdo real
  de estudo e segredos ficam fora do Git.

## Execução

Dia a dia: `pnpm dev` no PC; o celular acessa pelo navegador na mesma rede
(`http://<ip-do-pc>:3000`). Sem HTTPS na rede local; se for expor fora,
Tailscale, nunca port-forward. Deploy gratuito com login entra no MVP (D-035;
hospedagem e banco em A-011). Docker só nos testes do PR
(`docs/11-esteira.md`).

## Ordem de construção

Segue `docs/08-roadmap.md` (9 épicos do Jira, ATL-4 a ATL-12; o deploy
gratuito com login é o épico Infra e Deploy, D-035). Resumo da dependência:

1. Esteira e fundação (repositório, CI, Sonar, Docker de teste).
2. Identidade visual: tokens das 3 paletas e protótipo aprovado, antes do front.
3. `packages/db` schema v1 + migration + seed + importação. Sem isso nada roda.
4. `packages/core`: domínio, desbloqueio, FSRS, sessão do dia, ofensiva, XP.
5. `apps/web`: Painel → Praticar → registro. Primeiro ciclo completo.
6. Biblioteca (importar `.json` e `.md`), Ficha (Árvore), Planejar (Google).
7. Depois do MVP: extração de PDF, leitor, Evolução, plano da semana, chat da
   Jane.

Depois do MVP, nenhuma fase nova sem o MVP em uso real por duas semanas.

## Riscos arquiteturais e mitigação

| Risco | Mitigação |
|---|---|
| `core` vaza I/O "só para pegar a data" | ESLint `no-restricted-imports` + regra em CLAUDE.md + teste de determinismo |
| Schema muda toda semana e migrations viram bagunça | Schema v1 fecha cedo; depois só migration aditiva; `review_logs` nunca muda de forma |
| FSRS calibrado com dados ruins | `memory_states` é cache; `memory:rebuild` reconstrói dos logs quando a versão do algoritmo mudar |
| Next.js pesado para o PC de casa | Medir no primeiro ciclo (A-005); se pesar, trocar por Vite + Hono sem tocar em `core`/`db` |
| Google "modo teste" derruba o acesso | Ticket de teste antes do épico do Planejar (A-007) |
| Uma paleta quebra o contraste | Teste automático de contraste das 3 paletas no CI |
| Todas as tentativas no snapshot crescem | Paginar só se a medição mostrar lentidão; ofensiva e XP são cache reconstruível se precisar |

## Padrões de UI que a arquitetura assume

- **Sidebar dupla**: rail fixo com as 5 abas; menu contextual por aba, que some
  quando a aba tem um item só. No celular, rail vira barra inferior e o menu
  vira gaveta.
- **3 cliques**: Painel → Começar → Prova é 2. Painel → Ofício → Material é 2.
  Qualquer fluxo acima de 3 é bug de navegação.
- **Três paletas escuras**: troca por `data-theme` no `<html>`, valor lido de
  `settings.tema`. Componentes só conhecem tokens (`docs/05-atelie.md`).
