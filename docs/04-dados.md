# 04 · Modelo de dados

Schema v1 de `packages/db`. SQLite, Drizzle, migrations versionadas. Regras
gerais em `CLAUDE.md` e na skill `atelie-dados`; este documento é a referência
do que existe e por quê.

Convenções:

- IDs são ULID (`text`, 26 chars). Gerados na aplicação.
- Datas em ISO 8601 UTC (`text`). Conversão para o fuso do usuário na borda.
- Minutos e segundos são inteiros. Percentuais são `real` entre 0 e 1.
- Toda tabela tem `created_at`. As mutáveis têm `updated_at`. A aplicação
  preenche as duas quando o código não passa valor, e `updated_at` se renova a
  cada alteração (D-061).
- Booleanos são `integer` 0/1 com `CHECK (col IN (0,1))` (D-061).
- Enumerações são `text` com `CHECK (col IN (...))`. Sem tabela de lookup.
- `PRAGMA foreign_keys = ON` em toda conexão (não é padrão do SQLite).

## Mapa

```
programs ──< subjects (program_id opcional)
subjects ──< skills ──< items ──< review_logs ──< explanation_grades (1:1)
              │  │        │
              │  │        └──< memory_states (1:1, cache)
              │  └──< proofs
              └──< skill_prereqs (auto-relação)
skills >──< materials (via material_skills)
plans ──< plan_items >── skills
settings (independente); imports (auditoria, citada por explanation_grades)
```

## Tabelas

### `programs` — cursos

Nível **curso** acima da matéria, só no backend: sem tela no MVP (D-046). Vem
da grade de referência que a Jane usa para quebrar matéria ampla (D-045).

| coluna | tipo | regra |
|---|---|---|
| id | text PK | ULID |
| name | text NOT NULL UNIQUE | "Direito" |
| reference | text NOT NULL | grade de referência em texto livre: curso, instituição e ano ("Direito, USP, grade 2025") |
| archived_at | text | soft delete: curso encerrado continua ligado às matérias |
| created_at, updated_at | text NOT NULL | |

`reference` é texto livre de propósito (D-056): separar em colunas só quando o
mini curso (ATL-120) precisar.

### `subjects` — matérias

| coluna | tipo | regra |
|---|---|---|
| id | text PK | ULID |
| name | text NOT NULL UNIQUE | "Cálculo I" |
| program_id | text FK → programs | ON DELETE RESTRICT; nulo permitido (matéria avulsa, sem curso) |
| short_name | text | "Cálculo", para chips |
| color | text NOT NULL | hex, `CHECK (length = 7)` |
| icon | text NOT NULL | id do ícone na UI |
| weight | integer NOT NULL DEFAULT 0 | 0–100, `CHECK (weight BETWEEN 0 AND 100)` |
| exam_at | text | prazo de prova, se houver (não entra no cálculo do MVP) |
| archived_at | text | soft delete com motivo claro: matéria encerrada continua na Árvore |
| created_at, updated_at | text NOT NULL | |

### `skills` — Ofícios (nós da Árvore)

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| subject_id | text NOT NULL FK → subjects | ON DELETE RESTRICT |
| name | text NOT NULL | |
| label | text | nome curto para a Árvore |
| description | text | |
| icon | text NOT NULL | |
| depth | integer NOT NULL | profundidade no leque, `CHECK (depth >= 1)` |
| lane | real NOT NULL DEFAULT 0 | posição lateral, `CHECK (lane BETWEEN -1 AND 1)` |
| estimated_minutes | integer NOT NULL | `CHECK (estimated_minutes BETWEEN 10 AND 40)` |
| origin | text NOT NULL | `CHECK (origin IN ('manual','ia','import'))` |
| reviewed_by_user | integer NOT NULL DEFAULT 0 | 0/1, `CHECK (reviewed_by_user IN (0,1))` |
| source_material_id | text FK → materials ON DELETE SET NULL | capítulo de livro que virou Ofício |
| study_explanation | text | texto de estudo: explicação em markdown |
| study_recommendations_json | text | texto de estudo: JSON `{ material_id, page_from?, page_to?, note? }[]`, `CHECK (study_recommendations_json IS NULL OR json_valid(study_recommendations_json))` |
| study_guidance | text | texto de estudo: orientações em markdown (como estudar, o que observar) |
| study_faq_json | text | texto de estudo: JSON `{ question, answer }[]`, `CHECK (study_faq_json IS NULL OR json_valid(study_faq_json))` |
| not_applicable_json | text NOT NULL DEFAULT '[]' | dimensões que **não se aplicam** ao Ofício, marcadas pela Jane (D-043): JSON com zero ou mais de `"fluencia"`, `"problemas"`, `"explicacao"`, sem repetir. `CHECK (json_valid(not_applicable_json))` |
| created_at, updated_at | | |

`UNIQUE (subject_id, name)`.

As páginas do material de origem (`source.page_from` e `source.page_to` na
importação) ficam em `material_skills`, não em `skills`.

**Texto de estudo** (`study_*`, D-052, D-056): tudo opcional, lido na fase
Aprender do Ofício sem nenhuma tentativa. Ler esse texto **não grava
tentativa** (nenhuma linha em `review_logs`): não dá XP, não conta para a
ofensiva e não sobe domínio (D-013). As recomendações apontam para `materials`
pelo `material_id`, resolvido na importação a partir do nome ou do link; não
são copiadas para `material_skills`. Limites de tamanho no
`docs/09-schema-importacao.md`.

**"Não se aplica"** (`not_applicable_json`, D-043, D-057): Compreensão
conceitual e Autonomia sempre se aplicam, então `"conceitual"` e `"autonomia"`
são recusados. O SQLite não deixa conferir os valores de uma lista num `CHECK`
(seria uma subconsulta), então a lista é validada pelo Zod na importação e na
API, os dois únicos caminhos que escrevem aqui. Lista vazia: as 5 dimensões se
aplicam.

### `skill_prereqs` — arestas do grafo

| coluna | regra |
|---|---|
| skill_id | text NOT NULL FK → skills ON DELETE CASCADE |
| prereq_id | text NOT NULL FK → skills ON DELETE CASCADE |
| created_at | text NOT NULL |
| PK (skill_id, prereq_id) | |
| `CHECK (skill_id <> prereq_id)` | |

Aciclicidade é validada na importação e na API (`core/graph/validate`). O
banco não consegue garantir; por isso só esses dois caminhos escrevem aqui.

### `items` — questões e cartões

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| skill_id | text NOT NULL FK → skills ON DELETE CASCADE | |
| kind | text NOT NULL | `CHECK (kind IN ('multipla_escolha','cartao','aberta'))` |
| prompt | text NOT NULL | enunciado / frente |
| options_json | text | JSON `string[]` com exatamente 4 alternativas. Obrigatório em `multipla_escolha`; opcional em `cartao` (com alternativas = cartão de alternativas, sem = cartão dissertativo, D-043); nulo em `aberta`. `CHECK (options_json IS NULL OR (json_valid(options_json) AND json_array_length(options_json) = 4))`, `CHECK ((kind = 'multipla_escolha' AND options_json IS NOT NULL) OR kind = 'cartao' OR (kind = 'aberta' AND options_json IS NULL))` |
| answer | text NOT NULL | índice 0–3 (ME e cartão de alternativas) ou texto (cartão dissertativo e aberta) |
| explanation | text NOT NULL | `CHECK (length(explanation) >= 20)` — C-04 |
| difficulty | integer | 1–3, opcional, `CHECK (difficulty IS NULL OR difficulty BETWEEN 1 AND 3)` |
| dimension | text | dimensão que o item ajuda a provar, marcada pela Jane (D-057). `CHECK (dimension IS NULL OR dimension IN ('conceitual','fluencia','problemas','explicacao'))`, `CHECK (kind <> 'cartao' OR dimension IS NULL)`. Nulo = exercício geral, que conta só para a Autonomia |
| evidence | text | só em item conceitual: `CHECK (evidence IS NULL OR evidence IN ('reconhecimento','interpretacao','representacao','discriminacao'))`, `CHECK ((evidence IS NOT NULL) = (COALESCE(dimension, '') = 'conceitual'))`, `CHECK (COALESCE(evidence, '') <> 'interpretacao' OR kind = 'multipla_escolha')` |
| category | text | só em item de problemas: `CHECK (category IS NULL OR category IN ('rotineira','nao_rotineira','transferencia'))`, `CHECK ((category IS NOT NULL) = (COALESCE(dimension, '') = 'problemas'))` |
| expected_seconds | integer | tempo esperado, só em item de fluência e opcional; sem ele, o item não tem relógio (C-10). `CHECK (expected_seconds IS NULL OR (COALESCE(dimension, '') = 'fluencia' AND expected_seconds BETWEEN 1 AND 3600))` |
| followup | text | pergunta complementar, só em item de explicação: `CHECK ((followup IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao'))` |
| rubric_json | text | rubrica do item de explicação: objeto JSON com as chaves `correcao`, `justificativa`, `coerencia`, `aplicacao` e `limitacoes`, cada uma com o texto do que vale nota 2 neste item. `CHECK ((rubric_json IS NOT NULL) = (COALESCE(dimension, '') = 'explicacao'))`, `CHECK (rubric_json IS NULL OR json_valid(rubric_json))`, `CHECK (COALESCE(dimension, '') <> 'explicacao' OR kind = 'aberta')` |
| origin | text NOT NULL | `CHECK IN ('manual','ia','import')` |
| reviewed_by_user | integer NOT NULL DEFAULT 0 | 0/1, `CHECK (reviewed_by_user IN (0,1))` |
| source_material_id | text FK → materials ON DELETE SET NULL | |
| source_page | integer | |
| archived_at | text | item errado sai da fila sem apagar histórico |
| created_at, updated_at | | |

Índice: `items(skill_id)`.

**Marcação para as provas** (D-043, D-057). `dimension` substitui o antigo
`focus` da D-037, que só aceitava `'conceitual'`. Cada campo extra só existe na
dimensão que o usa, e os `CHECK` acima recusam a combinação errada:

| `dimension` | campos do item | para quê (`docs/03-gregor.md`, seção 9) |
|---|---|---|
| `conceitual` | `evidence` obrigatório (`interpretacao` só em ME) | 3 de 4 evidências, discriminação obrigatória |
| `fluencia` | `expected_seconds` opcional | 9 de 10, relógio só com tempo esperado |
| `problemas` | `category` obrigatório | rodada de 5: 2 rotineiros, 2 não rotineiros, 1 de transferência |
| `explicacao` | `followup` e `rubric_json` obrigatórios; `kind = 'aberta'` | rubrica avaliada pela Jane |
| nulo | nenhum | exercício geral: só a Autonomia |

Qualquer exercício (ME ou aberta) com acerto válido pode conquistar a
Autonomia, com ou sem `dimension`. Cartão nunca tem `dimension`, porque nunca
conquista prova (D-037).

### `review_logs` — o registro bruto. Append-only.

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| item_id | text NOT NULL FK → items ON DELETE RESTRICT | nunca apagar item com log |
| skill_id | text NOT NULL FK → skills ON DELETE RESTRICT | desnormalizado de propósito: consulta por Ofício sem join |
| reviewed_at | text NOT NULL | |
| mode | text NOT NULL | `CHECK IN ('prova','retoque','sessao','simulado')`. `sessao` = tentativa feita dentro de um bloco da sessão do dia |
| correct | integer NOT NULL | 0/1, `CHECK (correct IN (0,1))` |
| grade | integer | 1–4 para cartões (Errei, Difícil, Bom, Fácil), NULL para questões (o Gregor deriva a nota). `CHECK (grade IS NULL OR grade BETWEEN 1 AND 4)` |
| answer_ms | integer NOT NULL | tempo até responder, `CHECK (answer_ms >= 0)` |
| viewed_solution | integer NOT NULL DEFAULT 0 | C-05, `CHECK (viewed_solution IN (0,1))` |
| reasoning | text | raciocínio escrito, se houver (C-06) |
| response | text | resposta escrita: aberta, cartão dissertativo e o texto da Explicação. O XP do cartão dissertativo depende do mínimo escrito (D-043) |
| followup_answer | text | resposta à pergunta complementar, só em item de explicação |
| attempt | integer | cartão de alternativas: tentativas usadas, `CHECK (attempt IS NULL OR attempt BETWEEN 1 AND 3)`. Com `correct = 1`, acertou nessa tentativa; com `correct = 0`, esgotou. O XP vem daqui (D-043) |
| round_id | text | ULID da **rodada** da Resolução de problemas: o app gera quando o Gregor monta o conjunto de 5 itens e grava nas 5 tentativas. Nulo fora da rodada |
| timed | integer NOT NULL DEFAULT 0 | modo cronometrado, `CHECK (timed IN (0,1))` |
| session_id | text | agrupa tentativas de uma sessão do dia |
| created_at | text NOT NULL | |

**Sem `updated_at`. Sem UPDATE. Sem DELETE.** Índice: `review_logs(item_id, reviewed_at)` e `review_logs(skill_id, reviewed_at)`.

Os **2 dias diferentes** das provas Compreensão conceitual e Fluência não têm
coluna: o Gregor tira o dia de calendário de `reviewed_at` com o fuso de
`settings`, como na ofensiva. O `round_id` não ganha índice: o Gregor recebe o
histórico inteiro do Ofício pelo `review_logs(skill_id, reviewed_at)`.

É daqui que saem a **ofensiva** (qualquer linha conta como dia) e o **XP**
(derivados pelo Gregor; ver "O que não está no banco").

### `explanation_grades` — notas da Jane para a Explicação. Append-only.

A prova Explicação depende da avaliação da Jane, feita fora do app e trazida
pela importação (D-043). Enquanto a tentativa não tem linha aqui, ela fica
"aguardando avaliação" e não conta.

| coluna | tipo | regra |
|---|---|---|
| id | text PK | ULID vindo do arquivo de notas da Jane (idempotência) |
| review_log_id | text NOT NULL UNIQUE FK → review_logs ON DELETE RESTRICT | a tentativa avaliada; uma nota por tentativa |
| skill_id | text NOT NULL FK → skills ON DELETE RESTRICT | desnormalizado, como em `review_logs` |
| correcao | integer NOT NULL | `CHECK (correcao BETWEEN 0 AND 2)` |
| justificativa | integer NOT NULL | idem |
| coerencia | integer NOT NULL | idem |
| aplicacao | integer NOT NULL | idem |
| limitacoes | integer NOT NULL | idem |
| feedback | text | comentário da Jane para o Márcio |
| graded_at | text NOT NULL | quando a Jane avaliou |
| import_id | text NOT NULL FK → imports ON DELETE RESTRICT | arquivo de onde veio |
| created_at | text NOT NULL | |

**Sem UPDATE. Sem DELETE**, como `review_logs`: a nota é um fato do histórico.
Para reavaliar, o Márcio faz outra tentativa. A tabela guarda só as notas; se
elas aprovam ou não (8 de 10, Correção e Justificativa em 2) é conta do Gregor,
com os números de `params.ts`. Para o `core`, "`graded: true` e os 5 valores"
(seção 9 do `docs/03-gregor.md`) é a existência desta linha. Formato do arquivo
de notas no `docs/09-schema-importacao.md` (ATL-166).

### `proofs` — provas conquistadas por Ofício

| coluna | regra |
|---|---|
| skill_id | FK → skills ON DELETE CASCADE |
| kind | `CHECK IN ('conceitual','fluencia','problemas','autonomia','explicacao')` |
| review_log_id | NOT NULL FK → review_logs ON DELETE RESTRICT, a tentativa que completou o critério (na Explicação, a tentativa avaliada). Toda prova nasce de uma tentativa (D-062) |
| earned_at | text NOT NULL; faz o papel de `created_at` |
| PK (skill_id, kind) | uma prova de cada dimensão por Ofício |

Derivável de `review_logs` + `explanation_grades` + `core/evaluateProofs`, mas
materializada porque a Árvore lê isso a cada render. `memory:rebuild` também
reconstrói esta tabela. A prova Explicação nasce na importação das notas, não
na tentativa: a importação chama `evaluateProofs` na mesma transação. Nesse
caso o `earned_at` é o momento da importação.

### `memory_states` — cache do escalonador (FSRS)

| coluna | tipo | regra |
|---|---|---|
| item_id | text PK FK → items ON DELETE CASCADE | |
| due_at | text | próxima revisão |
| stability | real | FSRS |
| difficulty | real | FSRS |
| scheduled_days | integer NOT NULL DEFAULT 0 | intervalo agendado pelo FSRS, `CHECK (scheduled_days >= 0)` |
| learning_steps | integer NOT NULL DEFAULT 0 | passo da aprendizagem curta, gerido pelo FSRS, `CHECK (learning_steps >= 0)` |
| reps | integer NOT NULL DEFAULT 0 | `CHECK (reps >= 0)` |
| lapses | integer NOT NULL DEFAULT 0 | `CHECK (lapses >= 0)` |
| state | integer NOT NULL DEFAULT 0 | estado do cartão no `ts-fsrs`: 0 New, 1 Learning, 2 Review, 3 Relearning. `CHECK (state IN (0,1,2,3))` |
| last_review_at | text | |
| algo_version | text NOT NULL | `'fsrs-<versão>'`, a do algoritmo em uso |
| created_at, updated_at | text NOT NULL | |

As colunas são o `Card` do `ts-fsrs` 5.4 (D-062), menos o `elapsed_days`,
que é derivado e sai na versão 6. Índice: `memory_states(due_at)`. **Nunca**
guardar recuperabilidade. Reconstruível por `pnpm memory:rebuild`. Adicionou
coluna → atualize o rebuild no mesmo commit. Não há intervalo fixo nosso
(D-023): o `learning_steps` é estado do próprio FSRS.

### `materials` — Acervo (Biblioteca)

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| kind | text NOT NULL | `CHECK IN ('pdf','video','link','nota','livro','markdown')` |
| title | text NOT NULL | |
| author | text | |
| path | text | nome do arquivo relativo a `data/acervo/`, para `pdf` e `markdown` |
| url | text | para `video`/`link` |
| body | text | texto da `nota` (obrigatório) ou do `.md` enviado pela tela (D-063) |
| pages | integer | `CHECK (pages IS NULL OR pages >= 1)` |
| progress | real NOT NULL DEFAULT 0 | 0–1 (`CHECK`), informativo: **não entra em domínio** |
| meta_json | text | capa, glifo, capítulo atual; `CHECK json_valid` |
| created_at, updated_at | | |

CHECKs por tipo (D-063): `(path IS NOT NULL) = (kind IN ('pdf','markdown'))`,
`(url IS NOT NULL) = (kind IN ('video','link'))`, `body` só em `nota` e
`markdown`, e obrigatório em `nota`. O `markdown` é o `.md` guardado até a Jane
transformá-lo em JSON (D-028). Enviado pela tela, ele guarda o nome em `path` e
o texto em `body` (D-036); citado por nome, só o `path`. Detalhes no ticket da
Biblioteca. Extração de PDF e de link: fora do MVP.

`UNIQUE (path)` e `UNIQUE (url)`. No SQLite, `NULL` não colide com `NULL`, então
o UNIQUE só vale onde a coluna está preenchida. São a chave do **material
citado por nome** (D-049): a importação procura o material por `path` ou `url`
e, se não existir, cria a entrada com ULID novo, título igual ao nome do
arquivo sem extensão (ou ao link) e tipo deduzido:

| citado como | `kind` | coluna |
|---|---|---|
| nome terminado em `.pdf` | `pdf` | `path` |
| nome terminado em `.md` | `markdown` | `path` |
| link `http://` ou `https://` | `link` | `url` |

Outra extensão é erro na importação. O `UNIQUE` diferencia maiúsculas
(`Calculo.pdf` e `calculo.pdf` são dois materiais); o validador avisa quando
isso acontece, sem normalizar.

**PDF e markdown citados por nome são só referência** (D-050, D-056): o arquivo
fica no PC em `data/acervo/` e não vai para o banco nem para a nuvem; a linha
guarda só o `path`, sem `body`. O Márcio abre o arquivo fora do app.

### `material_skills`

`material_id` FK, `skill_id` FK (as duas ON DELETE CASCADE), `page_from`,
`page_to`, `created_at`, PK composta. Páginas `>= 1` e `page_from <= page_to`
quando as duas existem. Um material pode servir a vários Ofícios (livro por
capítulo).

### `plans` e `plan_items` — o que o Gregor decidiu

`plans`: `id`, `generated_at`, `mode` (`CHECK IN ('completa','curta')`),
`params_json` (cópia dos params), `state_hash` (hash do snapshot, para
reproduzir). O plano não se altera: `generated_at` faz o papel de `created_at`
e não há `updated_at` (D-063).

`plan_items`: `id`, `plan_id` FK CASCADE, `block` (`CHECK BETWEEN 1 AND 4`),
`position` (`>= 0`), `kind` (`CHECK IN ('revisao_previa','materia_nova','reforco','cartoes')`,
e o tipo acompanha o número do bloco), `skill_id` FK RESTRICT, `item_ids_json`
(`DEFAULT '[]'`), `minutes` (`>= 0`), `skipped` (0/1; blocos pulados ficam
registrados), `reason_json` (obrigatório), `breakdown_json`, `scheduled_start`
(preenchido pelo Planejar quando o evento é criado), `google_event_id` (idem),
`done_at`, `created_at`, `updated_at`. Uma linha por item da sessão; bloco
pulado é uma linha sem Ofício: `CHECK ((skill_id IS NULL) = (skipped = 1))`
(D-063). `UNIQUE (plan_id, block, position)`.

Índice: `plan_items(plan_id, scheduled_start)`. Planos antigos não são
apagados: são o histórico de "o que o sistema mandou". Os campos do Google
Agenda são afinados no ticket do Planejar (A-007).

### `settings`

Chave-valor (`key` PK, `value_json` com `CHECK json_valid`, `created_at`,
`updated_at`). Um usuário, sem tabela `users`. As chaves são validadas pelo Zod
na borda, não por `CHECK`, porque o Google Agenda vai somar outras. Chaves:

| chave | valor | padrão |
|---|---|---|
| `fuso_horario` | fuso do "dia" da ofensiva | `America/Sao_Paulo` |
| `tema` | paleta ativa: `tokyo` (E), `borgonha` (G), `verde` (H) | `borgonha` |

Dado de conexão do Google (acesso e renovação) **nunca** vai para o Git; onde
ele fica é decidido no ticket do Google Agenda (A-007).

### `imports` — auditoria da importação

`id`, `kind` (`CHECK IN ('conteudo','notas_explicacao')`, D-059), `file_name`,
`file_hash`, `ran_at`, `skills_inserted`, `items_inserted`, `grades_inserted`,
`skipped`, `errors_json`. Permite responder "de onde veio este item" e "de onde
veio esta nota".

A linha não se altera: `ran_at` faz o papel de `created_at`, sem `updated_at`.
Contadores `NOT NULL DEFAULT 0` e `>= 0`; arquivo de conteúdo tem
`grades_inserted = 0` e arquivo de notas tem `skills_inserted` e
`items_inserted` iguais a 0; `errors_json` `NOT NULL DEFAULT '[]'` com
`json_valid` (D-063).

## Fora do MVP, não criar agora (D-009 em espírito)

- `notes` (captura rápida): fora do MVP.
- `availability`: substituída pela leitura do Google Agenda (D-021).
- Tabela de XP, de nível ou de ofensiva: derivados, não guardados.

## Migrations

- `drizzle-kit generate` gera; você **lê o SQL** antes de aplicar. SQLite
  recria tabela para alterar coluna; é onde se perde dado.
- Uma migration por mudança lógica, com `down` testado.
- Nunca editar migration aplicada.
- Migration inicial (`0000_schema_v1`) cria tudo acima exceto o que a seção
  "Fora do MVP" lista, inclusive `programs`, `subjects.program_id`, os
  `UNIQUE` de `materials` e as colunas `study_*` de `skills` (ATL-123): não há
  migration 0001 para isso. O mesmo vale para as colunas das provas (ATL-153,
  D-057): `items.dimension`, `evidence`, `category`, `expected_seconds`,
  `followup`, `rubric_json` e as regras novas de `options_json`;
  `skills.not_applicable_json`; `review_logs.response`, `followup_answer`,
  `attempt` e `round_id`; a tabela `explanation_grades`; e `imports.kind` e
  `grades_inserted` (D-059). `items.focus` não
  existe mais.

## Seed (`pnpm db:seed`)

Cenário de desenvolvimento, nunca dado real:

- 2 matérias (Cálculo I, Redes), pesos 60/40.
- 8 Ofícios com grafo de pré-requisitos (dois ramos, uma junção).
- 10 itens por Ofício, mistura de ME e cartão, todos com explicação. No
  Ofício Dominado, itens marcados com `dimension` em número suficiente para
  cada critério da seção 9 do `docs/03-gregor.md`, uma rodada de problemas e
  uma nota da Jane em `explanation_grades`.
- `review_logs` simulando 3 semanas: um Ofício Dominado (as 5 dimensões), dois
  Liberados, um com erro recente (reforço), um "precisa revisar", itens e
  cartões vencidos hoje, e uma ofensiva em andamento.

O seed é o fixture dos testes de `core` também (exportado como JSON em
`packages/core/test/fixtures/seed.json`), para os dois lados usarem o mesmo
estado.

## Consultas previstas (e seus índices)

| Consulta | Índice |
|---|---|
| revisões vencidas: `memory_states WHERE due_at <= ?` | `memory_states(due_at)` |
| itens de um Ofício | `items(skill_id)` |
| histórico de um item | `review_logs(item_id, reviewed_at)` |
| histórico de um Ofício (domínio) | `review_logs(skill_id, reviewed_at)` |
| sessão do dia | `plan_items(plan_id, scheduled_start)` |
| explicações aguardando avaliação: `review_logs` de item `explicacao` sem linha em `explanation_grades` | `explanation_grades(review_log_id)` (o `UNIQUE`) |

Índice novo só com a consulta que o justifica.

## O que não está no banco

- Recuperabilidade (calculada pelo FSRS a partir do tempo decorrido).
- Domínio em si (calculado de `proofs`; `proofs` é cache reconstruível).
- Dia de calendário de cada tentativa (para os 2 dias das provas) e se a
  rubrica aprova: calculados pelo Gregor.
- **Ofensiva, XP e nível:** derivados de `review_logs` e `proofs` pelo Gregor,
  com os parâmetros em vigor. Sem tabela no MVP; se ficar lento, vira cache
  reconstruível.
- Arquivos binários (ficam em `data/acervo/`).
