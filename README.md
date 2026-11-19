# Ateliê

Sistema pessoal de estudos. Um ambiente só para decidir o que estudar,
guardar material, praticar, provar domínio e ver a evolução, com o Claude como
parte do fluxo.

- **Gregor**: motor de regras que decide o que estudar agora, calcula domínio,
  ofensiva e XP (`packages/core`). Não é IA.
- **Jane**: o Claude, gerando conteúdo e explicando (via Claude Code na v1).
- **App**: SQLite + Drizzle + Next.js + Tailwind (`packages/db`, `apps/web`),
  com cinco abas: Painel, Planejar, Biblioteca, Praticar e Ficha.

## Documentos

| Arquivo | Conteúdo |
|---|---|
| `CLAUDE.md` | Instruções para o Claude Code neste repositório |
| `docs/00-contexto.md` | O que é o Ateliê, escopo do MVP, princípios |
| `docs/01-arquitetura.md` | Stack, pacotes, fronteiras, ordem de construção |
| `docs/02-ciencia.md` | Base científica de cada regra do Gregor |
| `docs/03-gregor.md` | Especificação do Gregor |
| `docs/04-dados.md` | Schema v1 |
| `docs/05-atelie.md` | Telas, fluxo das abas e identidade visual (3 paletas) |
| `docs/06-decisoes.md` | Registro de decisões |
| `docs/07-glossario.md` | Nomes do Ateliê |
| `docs/08-roadmap.md` | Épicos do MVP e o que vem depois |
| `docs/09-schema-importacao.md` | Formato do JSON que a Jane gera |
| `docs/10-projeto-claude.md` | Configuração do Projeto no claude.ai |
| `docs/11-esteira.md` | Jira, Git, PR, CI, SonarCloud e Docker |
| `docs/historico/` | Visão original e protótipo antigo (só leitura, não editar) |

## Começar

Ainda não há código. A primeira entrega é o épico de fundação, que monta a
esteira (repositório, CI, SonarCloud, testes em Docker). Ver
`docs/08-roadmap.md` e `docs/11-esteira.md`. Depois dele:

```
pnpm install
pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Skills do Claude Code

`atelie-gregor`, `atelie-dados`, `atelie-conteudo`, `atelie-web`, em
`.claude/skills/`. Elas apontam para os docs acima. A skill `atelie-conteudo`
espera uma cópia de `docs/09-schema-importacao.md` em
`references/schema-importacao.md` dentro da pasta da skill; mantenha as duas
iguais.
