# 03 · O Gregor (motor)

Especificação de `packages/core`. O Gregor responde a perguntas de regra: **dado
o estado atual, o que está dominado, o que está desbloqueado, o que estudar hoje,
quantos dias seguidos, quanto XP?** É um motor de regras, determinístico. Não é
IA, não aprende sozinho, não chama rede. No MVP ele faz seis coisas: calcular
domínio, decidir o que está desbloqueado, agendar revisões (FSRS), montar a sessão
do dia, contar a ofensiva e somar o XP.

Leia `docs/02-ciencia.md` antes de alterar qualquer regra. Cada regra abaixo
cita a linha C-xx que a sustenta ou diz "hipótese".

## Princípios não negociáveis

1. **Puro.** Sem `Date.now()`, `Math.random()`, I/O, variável de ambiente ou
   import de `db`/`web`. `now`, `timezone` e `rng` entram como parâmetro.
2. **Determinístico.** Mesma entrada, mesma data, mesma saída, byte a byte.
3. **Explicável.** Toda saída tem `reason: string[]`. Sessão sem motivo é bug.
4. **Parametrizado.** Todo número de decisão em `params.ts`, com comentário
   dizendo se é hipótese ou evidência (e qual C-xx).
5. **Domínio sem erro de leitura.** Domínio só vem de prova; leitura não conta.
6. **FSRS atrás de adaptador.** Só `memory/fsrs-adapter.ts` importa `ts-fsrs`.
7. **Prova conquistada nunca é removida.** O decaimento é a revisão
   ("precisa revisar"), não a perda de prova.

## Entrada e saída

```ts
// types.ts
export type ISODate = string; // "2026-11-19T09:00:00Z"
export type ULID = string;

// As 5 dimensões de domínio (D-022). Cada uma é um tipo de prova.
export type ProofKind =
  | 'conceitual'   // compreensão conceitual
  | 'fluencia'     // fluência procedimental
  | 'problemas'    // resolução de problemas
  | 'autonomia'    // sem consultar
  | 'explicacao';  // explicar com as próprias palavras

export interface Proof { kind: ProofKind; at: ISODate; itemId: ULID }

export interface SkillState {
  id: ULID;
  subjectId: ULID;
  prereqIds: ULID[];
  proofs: Proof[];              // provas conquistadas (derivado de review_logs)
  errors: ISODate[];            // exercícios válidos errados (para o reforço); cartão não entra
  estimatedMinutes: number;     // 10–40, vem do conteúdo
}

export type ItemKind = 'multipla_escolha' | 'cartao' | 'aberta';
export type ItemFocus = 'conceitual'; // marcado pela Jane (D-037)

export interface MemoryItem {   // um item de prática com revisão agendada
  itemId: ULID;
  skillId: ULID;
  kind: ItemKind;
  focus: ItemFocus | null;      // null = item sem foco marcado
  dueAt: ISODate | null;        // null = nunca visto
  card: MemoryCard;             // estado FSRS (tipo opaco do adaptador)
}

export interface SubjectState { id: ULID; weight: number } // 0–100, soma 100

export interface Attempt {      // uma tentativa registrada (de review_logs)
  at: ISODate;
  correct: boolean;
  viewedSolution: boolean;
  kind: 'exercicio' | 'cartao';
  grade: 1 | 2 | 3 | 4 | null;  // cartões: Errei, Difícil, Bom, Fácil
  proofEarned: boolean;         // esta tentativa conquistou uma prova
}

export interface StateSnapshot {
  now: ISODate;
  timezone: string;             // "America/Sao_Paulo"
  skills: SkillState[];
  memory: MemoryItem[];
  subjects: SubjectState[];
  attempts: Attempt[];          // todas, em ordem; alimenta ofensiva e XP
}

export type SessionMode = 'completa' | 'curta';
export type BlockKind = 'revisao_previa' | 'materia_nova' | 'reforco' | 'cartoes';

export interface SessionItem {
  skillId: ULID;
  itemIds: ULID[];              // itens a praticar; vazio no bloco de matéria nova
  minutes: number;
  reason: string[];             // ex.: ["3 itens vencidos há 2 dias"]
  breakdown: Record<string, number>; // cada termo da ordenação, para auditoria
}

export interface SessionBlock {
  block: 1 | 2 | 3 | 4;
  kind: BlockKind;
  minutes: number;              // duração total do bloco nesta sessão
  items: SessionItem[];
  skipped: boolean;             // true = bloco vazio, pulado
  reason: string[];             // sempre preenchido, inclusive quando pulado
}

export interface DaySession {
  generatedAt: ISODate;
  mode: SessionMode;
  blocks: SessionBlock[];       // sempre 4, na ordem fixa
  params: Record<string, number | boolean | string>; // cópia dos params usados
}
```

`db` monta o `StateSnapshot`; `core` nunca consulta o banco. Todas as tentativas
vão no snapshot (milhares no primeiro semestre; é aceitável e mantém a função
pura).

## 1. Domínio e confiança (`mastery/`)

Base: C-01, C-15, C-18.

```
mastery(skill, now) -> { dimensions: 0..5, applicable: 3..5, confidence: 0..1, missing: ProofKind[] }

dimensions = número de tipos de prova diferentes conquistados
applicable = 5 - dimensões que a Jane marcou "não se aplica" no Ofício (D-043)
confidence = (dimensions / applicable) * (1 - penalidadeDeErro)
penalidadeDeErro = min(ERROR_PENALTY_MAX, errosRecentes * ERROR_PENALTY_EACH)
errosRecentes    = exercícios válidos errados nos últimos ERROR_WINDOW_DAYS dias
```

- **Domínio é cobertura:** quantas das dimensões que se aplicam o Márcio já
  provou naquele Ofício. Cada dimensão só conta uma vez (`proofs` tem PK
  `(skill_id, kind)`). Só a Fluência procedimental, a Resolução de problemas e
  a Explicação podem ser marcadas "não se aplica"; Compreensão conceitual e
  Autonomia sempre se aplicam (D-043).
- **Erro baixa a confiança, não o domínio.** O erro reduz `confidence` pela
  penalidade, que some quando a janela passa. `dimensions` nunca diminui. O
  Ofício com erro recente entra na fila de reforço (seção 5, bloco 3).
- Tentativas com `viewed_solution = true` não são válidas e nunca entram em
  domínio nem em `errors` (C-05).
- Cartão "Errei" não entra em `errors`: esquecer cartão é o fluxo normal do
  FSRS, tratado pela revisão e pelo "Precisa revisar" (D-038).
- `ERROR_WINDOW_DAYS = 14`, `ERROR_PENALTY_EACH = 0.10`, `ERROR_PENALTY_MAX =
  0.30` (todas hipótese, D-038). Exemplo: Ofício com 3 dimensões tem confiança
  0,60; com 1 erro recente, 0,54; com 2, 0,48; com 3 ou mais, 0,42 (teto).
  Passada a janela, volta a 0,60.

**Estados do Ofício** (para a Árvore e para o Painel):

| Estado | Regra |
|---|---|
| Bloqueado | algum pré-requisito ainda não é Liberado nem Dominado |
| Disponível | pré-requisitos cumpridos, 0 dimensões |
| Em prática | 1 dimensão, ou 2 ou mais sem a Compreensão conceitual |
| Liberado | 2 ou mais dimensões diferentes, uma delas a Compreensão conceitual, e ainda falta alguma que se aplica. Abre os Ofícios que dependem dele |
| Dominado | todas as dimensões que se aplicam (as 5, salvo "não se aplica") |

E um marcador à parte, que vale para qualquer estado com prova: **Precisa
revisar** (seção 3). Ele não muda o estado nem apaga dimensões.

Por que não usar FSRS para o domínio: FSRS mede memória de **itens**; domínio é
sobre o **Ofício**. Os dois se cruzam na revisão (seção 3), não na cobertura.

## 2. Desbloqueio (`graph/`)

Base: C-14.

```
isUnlocked(skill) = skill.prereqIds.every(id =>
  mastery(prereq).dimensions >= UNLOCK_MIN_DIMENSIONS
  && prereq tem a prova Compreensão conceitual)
```

- `UNLOCK_MIN_DIMENSIONS = 2` (hipótese). Duas dimensões **diferentes** já
  provam que não foi um acerto isolado; essa é a defesa contra o início a frio.
- Uma das duas tem de ser a Compreensão conceitual (D-043). Sem isso, a
  Autonomia, que é fácil, mais outra dimensão fácil abririam os dependentes sem
  que o conceito tenha sido provado.
- O grafo precisa ser acíclico. `graph/validate.ts` recusa ciclo na
  importação; `core` assume DAG.
- `unlocksCount(skill)` = quantos Ofícios dependem diretamente dele. Entra na
  ordenação do bloco de matéria nova (seção 5).

## 3. Memória e revisão (`memory/`)

Base: C-02, C-03, C-17.

**Um agendador só: FSRS** (D-023), para todos os itens (questões e cartões).
Não existe v0 com intervalos fixos. O adaptador `fsrs-adapter.ts` expõe:

```ts
schedule(card: MemoryCard, grade: 1|2|3|4, now: ISODate) -> { card, dueAt }
retrievability(card: MemoryCard, now: ISODate) -> 0..1
```

- Nunca armazenar recuperabilidade; calcular do tempo decorrido.
- `memory_states` é cache de `review_logs` e pode ser reconstruído
  (`pnpm memory:rebuild`). Trocar a versão do algoritmo muda só este arquivo e
  `params.ts`.
- Meta de retenção: `RETENTION_TARGET = 0.9` (parâmetro do Márcio; hipótese
  quanto ao valor).
- Nota de um item: cartão usa a nota dada (Errei=1, Difícil=2, Bom=3, Fácil=4);
  questão usa 1 se errou e 3 se acertou (hipótese).

**Revisão de Ofício, inclusive dominado.** A revisão do Ofício vem dos
itens dele:

```
recuperabilidadeDoOficio = média de retrievability(itens já vistos do Ofício)
precisaRevisar(skill)    = recuperabilidadeDoOficio < RETENTION_TARGET
```

- O bloco 1 da sessão (mini exercícios) revisa itens que não são cartão; o bloco
  4 revisa cartões. Os dois usam o mesmo FSRS.
- Passar da data só liga o marcador "Precisa revisar". As dimensões
  conquistadas ficam (princípio 7).

## 4. Ordenação simples com motivo (`planner/order.ts`)

No MVP não há fórmula de prioridade com pesos. Cada bloco da sessão ordena seus
candidatos por uma lista curta de critérios, nesta ordem, com desempate
determinístico por `id` lexicográfico. O `breakdown` guarda o valor de cada
critério usado.

Para o bloco 2 (matéria nova), os critérios são:

1. Ofício **em andamento** antes de Ofício novo (já tem ao menos uma prova e
   ainda não é Dominado).
2. Maior `subject.weight`.
3. Maior `unlocksCount`.
4. Menor `depth` na Árvore (mais perto da raiz).

A fórmula ponderada de prioridade (urgência, prazo de prova, lacuna, zona de
dificuldade) fica para depois do MVP (seção 12).

## 5. Sessão do dia (`planner/session.ts`)

```
planSession(state, mode: SessionMode, rng?) -> DaySession
```

A sessão tem **sempre 4 blocos, nesta ordem** (D-024):

| # | Bloco | Faixa de duração | O que entra |
|---|---|---|---|
| 1 | Revisão pré-matéria com mini exercícios | 10 a 15 min | Itens que não são cartão, com revisão vencida, agrupados por Ofício. Antes, os de pré-requisitos do Ofício do bloco 2 |
| 2 | Estudo da matéria nova | 40 a 50 min | O Ofício (ou Ofícios) de maior ordem na seção 4, até preencher a faixa |
| 3 | Reforço em pontos fracos | 20 a 30 min | Ofícios com erro recente (fila de reforço) e, depois, os "Precisa revisar" que não couberam no bloco 1 |
| 4 | Revisão com flashcards | 15 a 20 min | Cartões com revisão vencida |

Total de 85 a 115 minutos.

Duração exata de cada bloco (hipótese, D-038). O número é um **teto**: o bloco
enche até ele e termina antes se faltar o que estudar.

| Bloco | Completa (limite superior da faixa) | Curta (metade, arredondada para cima) |
|---|---|---|
| 1 Revisão pré-matéria | 15 | 8 |
| 2 Matéria nova | 50 | 25 |
| 3 Reforço | 30 | 15 |
| 4 Cartões | 20 | 10 |
| Total | 115 | 58 |

- Os dois conjuntos ficam em `params.ts` (`BLOCK_MINUTES_FULL` e
  `BLOCK_MINUTES_SHORT`), com os valores da tabela escritos à mão, não
  calculados.
- **Bloco vazio é pulado**, com `skipped = true` e o motivo escrito (por exemplo
  "nada com revisão vencida hoje"). O tempo não é redistribuído para os outros
  blocos.
- Itens de revisão custam `MIN_PER_MINI` minutos (hipótese, 2) e cartões
  `MIN_PER_CARD` (hipótese, 1,5). Entram até preencher o tempo do bloco.
- Um Ofício do bloco 2 usa `estimatedMinutes`. Se sobrar tempo no bloco, entra o
  próximo candidato que caiba.
- **Estudo parcial:** se o primeiro candidato do bloco 2 não cabe (por exemplo,
  Ofício de 40 min no bloco de 25 da Curta), ele entra mesmo assim com os
  minutos do bloco, e o `reason` diz que é parcial. Na sessão seguinte ele
  volta, porque a ordenação é determinística (D-038). Só o primeiro candidato
  ganha essa exceção.
- `rng` só embaralha a ordem dos **itens dentro** de um Ofício, nunca a ordem dos
  Ofícios. Vem com semente.
- Toda entrada ganha `reason` em português, legível na tela. Exemplo:
  `["3 itens vencidos há 2 dias", "pré-requisito de Regra da cadeia"]`.

Casos de borda obrigatórios:

- Usuário novo (zero tentativas): blocos 1, 3 e 4 pulados; o bloco 2 traz o
  primeiro Ofício de cada matéria, por peso.
- Nenhum Ofício disponível nem em andamento: bloco 2 pulado com motivo.
- Tudo Dominado e nada vencido: sessão com os 4 blocos pulados e um `reason`
  geral ("nada a estudar agora").
- `mode` curta com bloco 1, 3 ou 4 que, pela metade, não comporta nenhum item:
  bloco pulado com motivo. O bloco 2 nunca é pulado por falta de tempo: vale o
  estudo parcial.

O Planejar (Google Agenda) transforma a sessão em **um** evento com os blocos
descritos no texto. O Gregor não escolhe horário no MVP.

## 6. Ofensiva (`streak/`)

Base: C-16.

```
streak(attempts, now, timezone) -> { current, best, activeToday }
```

- **Qualquer tentativa registrada conta** como um dia: certa, errada ou com a
  solução vista. **Ler material não conta** (D-013).
- O dia é o calendário do `timezone` (`America/Sao_Paulo`). `now` entra como
  parâmetro; o Gregor nunca olha o relógio.
- `current` = dias consecutivos terminando hoje; se hoje ainda não tem
  tentativa, conta a sequência que terminou ontem (o dia de hoje ainda não
  acabou). `best` = maior sequência da história. Sem proteção de dia perdido no
  MVP (D-027): perdeu um dia inteiro, `current` volta a zero e o `best` fica.

## 7. XP e nível (`xp/`)

Base: nenhuma (hipótese de produto; D-021).

```
xpOf(attempt) -> number
level(totalXp) -> { level, xpInLevel, xpToNext }
```

Dão XP: acerto **válido** em exercício, prova conquistada, cartão respondido
(o XP vem das **tentativas** ou do texto escrito, nunca da nota que o Márcio se
dá; D-043). Não dão XP: tentativa errada, cartão com as tentativas esgotadas,
tentativa com solução vista, leitura. Redação corrigida dá XP, mas fica para
depois do MVP.

**Cartão (D-043).** O Márcio responde antes de ver o verso: por **alternativas**
(o sistema corrige; alternativa errada trava e ele tenta outra) ou por **texto**
(dissertativa). Depois dá a nota (Errei, Difícil, Bom, Fácil) que alimenta o
FSRS, mas com um **teto** vindo do resultado: acertou na 1ª tentativa, qualquer
nota; na 2ª ou na 3ª, no máximo Difícil; esgotou as tentativas, só Errei. Na
dissertativa não há como corrigir: o XP é fixo, se escreveu o mínimo de
caracteres, e a nota só agenda a revisão.

Tabela inicial (**hipótese**, D-038):

| Evento | XP | `params.ts` |
|---|---|---|
| Acerto válido em exercício | 10 | `XP_CORRECT` |
| Prova conquistada (bônus, soma ao acerto) | 40 | `XP_PROOF_BONUS` |
| Cartão de alternativas, acerto na 1ª tentativa | 7 | `XP_CARD_TRY_1` |
| Cartão de alternativas, acerto na 2ª tentativa | 5 | `XP_CARD_TRY_2` |
| Cartão de alternativas, acerto na 3ª tentativa | 3 | `XP_CARD_TRY_3` |
| Cartão dissertativo, com o mínimo escrito | 3 | `XP_CARD_WRITTEN` |

(Na D-038 o XP do cartão era 3, 5 e 7 pela nota Difícil, Bom e Fácil; a D-043
trocou a base pela tentativa. Os valores são os mesmos, então o XP total
estimado não muda.)

Curva de níveis: subir do nível `n` para `n + 1` custa `LEVEL_COST_STEP * n`
XP, com `LEVEL_COST_STEP = 100` (hipótese, D-038): nível 1 → 2 custa 100,
2 → 3 custa 200, e assim por diante. Chegar ao nível `N` custa, no total,
`50 * N * (N - 1)` XP. Todo mundo começa no nível 1.

Estimativa usada para aprovar os valores (conta de 2026-11-20, não medição):
uma sessão Completa em ritmo, com uns 75% de acerto, dá cerca de 330 XP; a
Curta, 165. Uma semana com 5 Completas e 2 Curtas dá cerca de 2.000 XP: nível 6
na primeira semana, 13 no primeiro mês, 32 no semestre e 46 no ano. Rever com
o XP real de `review_logs` depois de algumas semanas.

Benefícios por nível ficam para depois. O XP total é derivado de
`review_logs` e `proofs`; não há tabela de XP (`docs/04-dados.md`).

## 8. Registro de prova (fora do core, mas o core define o contrato)

`db` chama, dentro de uma transação:

```
recordReview(log: ReviewLog) ->
  1. append em review_logs
  2. se válido (não viewed_solution): memory.schedule(...) -> memory_states
  3. se acerto e preenche critério de prova (seção 9): grava proof no skill
```

O `core` expõe `evaluateProofs(skill, history, now) -> ProofKind[]`, que olha
o **histórico** do Ofício (`review_logs` do Ofício, mais as avaliações da Jane) e
devolve as provas que passaram a estar conquistadas (D-043). A prova deixou de
ser decidida por uma tentativa: quase todas pedem várias, em dias diferentes. O
resultado continua derivado do log, então `pnpm memory:rebuild` e o recálculo
das provas dão o mesmo resultado.

## 9. Critérios de prova

Todos os números desta seção são **hipótese** (D-043, C-19), ficam em
`params.ts` e serão revistos com o uso real. Em todas, tentativa com
`viewed_solution = true` não vale (C-05).

| Prova (dimensão) | Critério | Base |
|---|---|---|
| Autonomia | um acerto válido em exercício, com `answerMs >= FAST_ANSWER_MS` ou raciocínio escrito (mínimo `REASONING_MIN_CHARS = 15`). É a dimensão de entrada: a única que um acerto isolado conquista | C-01, C-05, C-06 |
| Compreensão conceitual | acertos válidos em itens conceituais de pelo menos `CONCEPT_MIN_EVIDENCES = 3` das 4 evidências (`reconhecimento`, `interpretacao`, `representacao`, `discriminacao`), com a **discriminação obrigatória**, em pelo menos `CONCEPT_MIN_DAYS = 2` dias de calendário diferentes; o último registro de cada evidência usada tem de ser acerto. A `interpretacao` é de múltipla escolha ("qual reformulação mantém o significado?"), para não repetir a Explicação | C-18, C-19 |
| Fluência procedimental | `FLUENCY_MIN_CORRECT = 9` acertos nos últimos `FLUENCY_WINDOW = 10` exercícios de procedimento, sem ajuda, em pelo menos `FLUENCY_MIN_DAYS = 2` dias diferentes e no mínimo `FLUENCY_MIN_PER_DAY = 4` por dia. Item com `expected_seconds` só conta como acerto até `FLUENCY_TIME_FACTOR = 2` vezes esse tempo; item sem tempo esperado não tem relógio | C-10, C-19 |
| Resolução de problemas | um conjunto de 5 problemas **inéditos** no Ofício (2 rotineiros, 2 não rotineiros, 1 de transferência), sem ajuda; `PROBLEM_MIN_CORRECT = 4` acertos, com a **transferência obrigatória**. Quem reprova gasta os 5 itens e recebe outros | C-08, C-19 |
| Explicação | item com rubrica e pergunta complementar, avaliado pela Jane (fora do app, depois importado): 5 critérios de 0 a 2 (Correção, Justificativa, Coerência, Aplicação, Limitações); soma `EXPLAIN_MIN_TOTAL = 8` de 10, Correção e Justificativa em 2, Coerência e Aplicação pelo menos 1, Limitações pelo menos 0. Sem avaliação, fica "aguardando avaliação" e não conta | C-07, C-19 |

Pontos de desenho:

- **A ordem de verificação deixou de existir.** Cada prova olha o próprio
  histórico; uma tentativa pode contar para mais de uma (um acerto conceitual
  também pode ser a Autonomia). A regra antiga "uma tentativa conquista no
  máximo uma prova" foi retirada junto com a exceção do `focus`.
- **O Gregor monta o conjunto da Resolução:** escolhe 5 itens inéditos com a
  composição pedida e só avalia quando os 5 foram respondidos. Quantos itens o
  Ofício precisa ter está em `docs/09-schema-importacao.md` (ticket de schema).
- **Explicação sem IA no Gregor:** o core recebe as notas da rubrica já
  prontas (`graded: true` e os 5 valores). O app exporta as explicações
  pendentes, a Jane avalia fora dele e o JSON de notas entra pela importação.
- **"Não se aplica":** a Jane marca no Ofício as dimensões que não fazem
  sentido (Fluência em Filosofia, por exemplo). Dominado exige todas as que se
  aplicam; a Compreensão conceitual e a Autonomia sempre se aplicam.
- **Marcação dos itens:** os campos novos (`dimension`, `evidence`, `category`,
  `expected_seconds`, `followup`, `rubric`, `not_applicable`) e o tamanho mínimo
  do banco por Ofício ficam no ticket de schema e conteúdo. O validador avisa
  quando um Ofício não tem itens para fechar alguma dimensão, sem recusar.

Só exercício (`multipla_escolha` ou `aberta`) conquista prova. Cartão nunca
conquista, porque a nota do cartão é autoavaliação (D-037). Cartão continua
dando XP (seção 7) e sendo agendado pelo FSRS (seção 3). O tipo de prova que o
modal oferece depende da dimensão que falta e do item.

## 10. `params.ts`

Um arquivo, exportações nomeadas, cada uma com comentário:

```ts
/** HIPÓTESE (2026-11): duas dimensões diferentes liberam o próximo Ofício. C-14 sustenta o termo, não o valor. */
export const UNLOCK_MIN_DIMENSIONS = 2;
/** EVIDÊNCIA: C-04. Validador recusa item sem explicação. */
export const FEEDBACK_REQUIRED = true;
```

Lista inicial: `UNLOCK_MIN_DIMENSIONS`, `RETENTION_TARGET`, `ERROR_WINDOW_DAYS`,
`ERROR_PENALTY_EACH`, `ERROR_PENALTY_MAX`, `FAST_ANSWER_MS`,
`REASONING_MIN_CHARS`, `CONCEPT_MIN_EVIDENCES`, `CONCEPT_MIN_DAYS`,
`FLUENCY_WINDOW`, `FLUENCY_MIN_CORRECT`, `FLUENCY_MIN_DAYS`,
`FLUENCY_MIN_PER_DAY`, `FLUENCY_TIME_FACTOR`, `PROBLEM_MIN_CORRECT`,
`EXPLAIN_MIN_TOTAL`, `BLOCK_MINUTES_FULL`,
`BLOCK_MINUTES_SHORT`, `MIN_PER_MINI`, `MIN_PER_CARD`, `XP_CORRECT`,
`XP_PROOF_BONUS`, `XP_CARD_TRY_1`, `XP_CARD_TRY_2`, `XP_CARD_TRY_3`,
`XP_CARD_WRITTEN`, `CARD_WRITTEN_MIN_CHARS`,
`LEVEL_COST_STEP`, `FEEDBACK_REQUIRED`.

`DaySession.params` recebe uma cópia desses valores. Mudou parâmetro, sessões
antigas continuam auditáveis.

## 11. Testes (`packages/core/test`)

Cobertura alta nesta pasta é obrigatória no CI (`docs/11-esteira.md`). Mínimo
para qualquer mudança de regra, com datas fixas:

1. Caso normal (seed de duas matérias, grafo com pré-requisito, revisões
   vencidas).
2. Usuário novo, zero histórico.
3. Degenerado: nenhuma tentativa, lista vazia, grafo vazio.
4. Determinismo: `planSession(x)` deep-equals `planSession(x)` e, com `rng`
   semeado, ordem de itens idêntica.

Mais: ciclo no grafo; cada critério de prova; `viewed_solution` não altera
domínio nem XP; erro baixa a confiança mas não as dimensões; bloco vazio é
pulado com motivo; modo curta divide as faixas; ofensiva na virada do dia (23h59
e 00:01 em São Paulo, com datas fixas) e com dia perdido; XP de cada evento e
nenhum XP para erro; mudança de `params` altera `breakdown` mas não quebra o
determinismo.

## 12. O que o Gregor não faz (e por quê)

- **Não gera conteúdo.** Isso é a Jane (`docs/09-schema-importacao.md`).
- **Não usa IA para planejar.** Caro, lento, não determinístico, impossível de
  depurar. D-003 em `docs/06-decisoes.md`.
- **Não escolhe horário** no MVP: o Márcio escolhe, o Planejar cria o evento.
- **Não aprende os parâmetros sozinho.** São revisados à mão, olhando
  `breakdown` e `review_logs` depois de algumas semanas de uso.

## 13. Evolução prevista

| Quando | Mudança no core |
|---|---|
| MVP | domínio por 5 dimensões com provas sobre o histórico, Explicação avaliada pela Jane (importada, `graded`), desbloqueio, FSRS, sessão do dia, ofensiva, XP |
| Depois do MVP | prazo de prova na ordenação; plano da semana (`planWeek`); fórmula de prioridade com pesos; intercalação (C-12) e zona de dificuldade (C-13); proteção de ofensiva; benefícios por nível; sessão em etapas com relógio |
| Futuro | recalibração de parâmetros a partir de `review_logs` |
