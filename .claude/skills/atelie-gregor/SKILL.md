---
name: atelie-gregor
description: Regras obrigatórias para trabalhar no Gregor, o motor de regras do Ateliê (packages/core) — domínio por 5 dimensões, desbloqueio, revisão espaçada com FSRS, sessão do dia em 4 blocos, ofensiva e XP. Use sempre que a tarefa envolver agendamento de estudo, revisão espaçada, FSRS, cálculo de domínio ou confiança de um Ofício, árvore de pré-requisitos, sessão do dia, ofensiva, XP, nível, ou qualquer arquivo dentro de packages/core — mesmo que o pedido pareça uma mudança pequena, e mesmo que a palavra "motor" ou "Gregor" não apareça no pedido.
---

# Trabalhar no Gregor

O Gregor decide o que o usuário estuda e conta o progresso dele. Um erro aqui não
quebra a tela: faz o usuário estudar a coisa errada durante semanas sem perceber,
ou perder uma ofensiva que era dele. Por isso as regras abaixo são rígidas.

Leia `docs/03-gregor.md` antes de escrever código. Leia `docs/02-ciencia.md`
quando for criar ou alterar uma regra de decisão. Use os nomes de
`docs/07-glossario.md`: o Gregor não é IA, é um motor de regras. O ticket do
Jira (chave `ATL`) diz qual regra mudar; siga `docs/11-esteira.md`.

## Contrato

```ts
planSession(state: StateSnapshot, mode: 'completa' | 'curta', rng?: Rng) -> DaySession
mastery(skill: SkillState, now: ISODate) -> { dimensions: 0..5; confidence: 0..1; missing: ProofKind[] }
isUnlocked(skill: SkillState, all: SkillState[]) -> boolean
needsReview(skill: SkillState, memory: MemoryItem[], now: ISODate) -> boolean
evaluateProofs(skill: SkillState, history: ReviewHistory, now: ISODate) -> ProofKind[]
streak(attempts: Attempt[], now: ISODate, timezone: string) -> { current: number; best: number; activeToday: boolean }
xpOf(attempt: Attempt) -> number
level(totalXp: number) -> { level: number; xpInLevel: number; xpToNext: number }
```

Tipos completos em `docs/03-gregor.md`. `db` monta o `StateSnapshot`; o core nunca
consulta o banco.

## Pureza

`packages/core` não pode importar `db`, `api`, `web`, nem nada que faça I/O.

Proibido dentro de `core`:
- `new Date()` ou `Date.now()` sem argumento. A data de "agora" e o fuso entram
  como parâmetro (`state.now`, `state.timezone`). A ofensiva na virada do dia só
  é testável assim.
- `Math.random()`. Se precisar de aleatoriedade (embaralhar itens dentro de um
  Ofício), receba um gerador com semente. A ordem dos Ofícios nunca é aleatória.
- Leitura de variável de ambiente, de arquivo ou de rede.

Isso existe para uma coisa só: reproduzir uma decisão. Quando o usuário perguntar
"por que o programa me mandou estudar isso na terça", você precisa rodar a mesma
entrada e obter a mesma saída.

## Parâmetros

Todo número que influencia decisão fica em `core/src/params.ts`, nunca no meio
da lógica. Cada um leva um comentário com a origem:

```ts
/** HIPÓTESE (2026-11): duas dimensões diferentes liberam o próximo Ofício. C-14 sustenta o termo, não o valor. */
export const UNLOCK_MIN_DIMENSIONS = 2;

/** EVIDÊNCIA: docs/02-ciencia.md C-04 — feedback obrigatório. */
export const FEEDBACK_REQUIRED = true;
```

Se não souber dizer se um número é hipótese ou evidência, ele é hipótese.
Marque assim. `DaySession.params` recebe uma cópia dos valores usados. XP, curva
de nível, penalidade de erro e durações dos blocos são hipótese até haver uso
real.

## FSRS

Não reimplemente a matemática do FSRS. Use a biblioteca (`ts-fsrs`), atrás de
`core/src/memory/fsrs-adapter.ts`. Nenhum outro arquivo importa a biblioteca
direto. O dia em que a versão do algoritmo mudar, só esse arquivo muda.

O FSRS agenda **todos os itens desde o MVP**; não existem intervalos fixos. A
revisão de um Ofício vem da recuperabilidade média dos itens dele, contra
`RETENTION_TARGET`. Nunca armazene recuperabilidade: calcule a partir do tempo
decorrido.

## Explicabilidade

Toda decisão devolve `reason: string[]` (frases em português, legíveis na tela)
e `breakdown` (cada critério de ordenação). Uma saída sem motivo é um bug, mesmo
que o resultado esteja correto. Bloco pulado também tem motivo.

## Domínio: 5 dimensões, sem perder prova

Domínio é a cobertura das 5 dimensões (conceitual, fluência, problemas,
autonomia, explicação). **Liberado** = 2 dimensões diferentes (abre os
dependentes). **Dominado** = as 5. Confiança = dimensões ÷ 5, menos uma
penalidade temporária por erro recente.

- Erro **baixa a confiança**, nunca as dimensões, e põe o Ofício na fila de
  reforço (bloco 3). Só exercício errado conta; cartão "Errei" não (D-038).
- Prova conquistada **nunca é removida**. O decaimento é o marcador "Precisa
  revisar", vindo do FSRS.
- Tentativas com `viewed_solution = true` nunca entram em domínio, em XP nem em
  erro (C-05). Elas contam para a ofensiva.
- Não simplifique isso de novo sem decisão nova em `docs/06-decisoes.md` (D-022).

## Sessão do dia

4 blocos fixos, nesta ordem: revisão pré-matéria com mini exercícios (10–15
min), matéria nova (40–50), reforço em pontos fracos (20–30), cartões (15–20).
Modos Completa (15/50/30/20, teto) e Curta (8/25/15/10). Bloco vazio é pulado,
com motivo; o tempo não é redistribuído. Primeiro Ofício do bloco 2 que não cabe
entra como estudo parcial (D-038). O Gregor não escolhe horário (o Planejar cria **um** evento por
sessão).

## Ofensiva e XP

- **Ofensiva:** qualquer tentativa registrada conta como um dia (certa, errada
  ou com solução vista); ler não conta; dia do fuso `America/Sao_Paulo`; sem
  proteção de dia perdido no MVP.
- **XP:** só acerto válido, prova conquistada e cartão Difícil/Bom/Fácil. Erro,
  cartão "Errei", solução vista e leitura não dão XP.

## Provas

Os critérios das cinco provas estão em `docs/03-gregor.md`, seção 9. A prova é
calculada sobre o **histórico** do Ofício (`review_logs` e as notas da Jane em
`explanation_grades`), não sobre uma tentativa (D-043); só a Autonomia sai de
um acerto isolado. O item diz a que prova serve por `items.dimension` e pelos
campos dela (`evidence`, `category`, `expected_seconds`, `rubric_json`; D-057).
Cartão nunca conquista prova (D-037).

## Testes

Teste junto com a mudança, nunca depois. Cobertura alta em `packages/core` é
exigida pelo CI. Mínimo para qualquer alteração de regra:

1. O caso normal (fixture `packages/core/test/fixtures/seed.json`, o mesmo do
   seed do banco).
2. O usuário novo, sem nenhum histórico.
3. O caso degenerado: nenhuma tentativa, nenhum item, grafo vazio.
4. Determinismo: a mesma entrada com a mesma data dá exatamente a mesma saída.

Ofensiva e XP têm casos próprios (virada do dia em São Paulo, dia perdido, erro
sem XP). Use datas fixas nos testes. Se um teste precisa da data de hoje para
passar, o teste está errado.

## Antes de encerrar

Diga no chat: o que mudou, qual regra de decisão foi afetada, e qual linha de
`docs/02-ciencia.md` a sustenta. Se não sustenta nenhuma, diga que é hipótese.
Se a mudança for uma decisão de produto, acrescente a linha em
`docs/06-decisoes.md`.
