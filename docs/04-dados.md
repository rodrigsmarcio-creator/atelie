# 04 · Modelo de dados

Schema v1 de `packages/db`. SQLite, Drizzle, migrations versionadas. Regras
gerais em `CLAUDE.md` e na skill `atelie-dados`; este documento é a referência
do que existe e por quê.

Convenções:

- IDs são ULID (`text`, 26 chars). Gerados na aplicação.
- Datas em ISO 8601 UTC (`text`). Conversão para o fuso do usuário na borda.
- Minutos e segundos são inteiros. Percentuais são `real` entre 0 e 1.
- Toda tabela tem `created_at`. As mutáveis têm `updated_at`.
- Enumerações são `text` com `CHECK (col IN (...))`. Sem tabela de lookup.
- `PRAGMA foreign_keys = ON` em toda conexão (não é padrão do SQLite).

## Mapa

```
programs ──< subjects (program_id opcional)
subjects ──< skills ──< items ──< review_logs
              │  │        │
              │  │        └──< memory_states (1:1, cache)
              │  └──< proofs
              └──< skill_prereqs (auto-relação)
skills >──< materials (via material_skills)
plans ──< plan_items >── skills
settings, imports (independentes)
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
| reviewed_by_user | integer NOT NULL DEFAULT 0 | 0/1 |
| source_material_id | text FK → materials | capítulo de livro que virou Ofício |
| study_explanation | text | texto de estudo: explicação em markdown |
| study_recommendations_json | text | texto de estudo: JSON `{ material_id, page_from?, page_to?, note? }[]`, `CHECK (study_recommendations_json IS NULL OR json_valid(study_recommendations_json))` |
| study_guidance | text | texto de estudo: orientações em markdown (como estudar, o que observar) |
| study_faq_json | text | texto de estudo: JSON `{ question, answer }[]`, `CHECK (study_faq_json IS NULL OR json_valid(study_faq_json))` |
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

### `skill_prereqs` — arestas do grafo

| coluna | regra |
|---|---|
| skill_id | text NOT NULL FK → skills ON DELETE CASCADE |
| prereq_id | text NOT NULL FK → skills ON DELETE CASCADE |
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
| options_json | text | JSON `string[]`, obrigatório se `multipla_escolha` |
| answer | text NOT NULL | índice (ME) ou texto (cartão/aberta) |
| explanation | text NOT NULL | `CHECK (length(explanation) >= 20)` — C-04 |
| difficulty | integer | 1–3, opcional |
| focus | text | `CHECK (focus IS NULL OR focus = 'conceitual')`. Marcado pela Jane; item conceitual conquista a prova Compreensão conceitual (D-037) |
| origin | text NOT NULL | `CHECK IN ('manual','ia','import')` |
| reviewed_by_user | integer NOT NULL DEFAULT 0 | |
| source_material_id | text FK → materials | |
| source_page | integer | |
| archived_at | text | item errado sai da fila sem apagar histórico |
| created_at, updated_at | | |

Índice: `items(skill_id)`.

`focus` fecha a A-006 (D-037). Hoje só aceita `'conceitual'`; outro valor
entra só com decisão nova. Cartão com `focus` é aceito, mas não conquista prova
(`docs/03-gregor.md`, seção 9).

### `review_logs` — o registro bruto. Append-only.

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| item_id | text NOT NULL FK → items ON DELETE RESTRICT | nunca apagar item com log |
| skill_id | text NOT NULL FK → skills | desnormalizado de propósito: consulta por Ofício sem join |
| reviewed_at | text NOT NULL | |
| mode | text NOT NULL | `CHECK IN ('prova','retoque','sessao','simulado')`. `sessao` = tentativa feita dentro de um bloco da sessão do dia |
| correct | integer NOT NULL | 0/1 |
| grade | integer | 1–4 para cartões (Errei, Difícil, Bom, Fácil), NULL para questões (o Gregor deriva a nota) |
| answer_ms | integer NOT NULL | tempo até responder |
| viewed_solution | integer NOT NULL DEFAULT 0 | C-05 |
| reasoning | text | raciocínio escrito, se houver |
| timed | integer NOT NULL DEFAULT 0 | modo cronometrado |
| session_id | text | agrupa tentativas de uma sessão do dia |
| created_at | text NOT NULL | |

**Sem `updated_at`. Sem UPDATE. Sem DELETE.** Índice: `review_logs(item_id, reviewed_at)` e `review_logs(skill_id, reviewed_at)`.

É daqui que saem a **ofensiva** (qualquer linha conta como dia) e o **XP**
(derivados pelo Gregor; ver "O que não está no banco").

### `proofs` — provas conquistadas por Ofício

| coluna | regra |
|---|---|
| skill_id | FK → skills ON DELETE CASCADE |
| kind | `CHECK IN ('conceitual','fluencia','problemas','autonomia','explicacao')` |
| review_log_id | FK → review_logs, a tentativa que conquistou |
| earned_at | text NOT NULL |
| PK (skill_id, kind) | uma prova de cada dimensão por Ofício |

Derivável de `review_logs` + `core/evaluateProof`, mas materializada porque a
Árvore lê isso a cada render. `memory:rebuild` também reconstrói esta tabela.

### `memory_states` — cache do escalonador (FSRS)

| coluna | tipo | regra |
|---|---|---|
| item_id | text PK FK → items ON DELETE CASCADE | |
| due_at | text | próxima revisão |
| stability | real | FSRS |
| difficulty | real | FSRS |
| reps | integer NOT NULL DEFAULT 0 | |
| lapses | integer NOT NULL DEFAULT 0 | |
| last_review_at | text | |
| algo_version | text NOT NULL | `'fsrs-<versão>'`, a do algoritmo em uso |
| updated_at | text NOT NULL | |

As colunas de estado do `ts-fsrs` (por exemplo o estado do cartão) são
completadas no ticket do schema, conforme a versão da biblioteca. Índice:
`memory_states(due_at)`. **Nunca** guardar recuperabilidade. Reconstruível por
`pnpm memory:rebuild`. Adicionou coluna → atualize o rebuild no mesmo commit.
Não há `step` nem intervalos fixos (D-023).

### `materials` — Acervo (Biblioteca)

| coluna | tipo | regra |
|---|---|---|
| id | text PK | |
| kind | text NOT NULL | `CHECK IN ('pdf','video','link','nota','livro','markdown')` |
| title | text NOT NULL | |
| author | text | |
| path | text | relativo a `data/acervo/`, para `pdf` e `markdown` |
| url | text | para `video`/`link` |
| body | text | para `nota` |
| pages | integer | |
| progress | real NOT NULL DEFAULT 0 | 0–1, informativo: **não entra em domínio** |
| meta_json | text | capa, glifo, capítulo atual |
| created_at, updated_at | | |

`CHECK ((kind IN ('pdf','markdown')) = (path IS NOT NULL))` e equivalente para
url/body. O `markdown` é o `.md` guardado até a Jane transformá-lo em JSON
(D-028). Detalhes no ticket da Biblioteca. Extração de PDF e de link: fora do
MVP.

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

`material_id` FK, `skill_id` FK, `page_from`, `page_to`, PK composta. Um
material pode servir a vários Ofícios (livro por capítulo).

### `plans` e `plan_items` — o que o Gregor decidiu

`plans`: `id`, `generated_at`, `mode` (`CHECK IN ('completa','curta')`),
`params_json` (cópia dos params), `state_hash` (hash do snapshot, para
reproduzir).

`plan_items`: `id`, `plan_id` FK CASCADE, `block` (`CHECK BETWEEN 1 AND 4`),
`position`, `kind` (`CHECK IN ('revisao_previa','materia_nova','reforco','cartoes')`),
`skill_id` FK, `item_ids_json`, `minutes`, `skipped` (blocos pulados ficam
registrados), `reason_json`, `breakdown_json`, `scheduled_start` (preenchido
pelo Planejar quando o evento é criado), `google_event_id` (idem), `done_at`.

Índice: `plan_items(plan_id, scheduled_start)`. Planos antigos não são
apagados: são o histórico de "o que o sistema mandou". Os campos do Google
Agenda são afinados no ticket do Planejar (A-007).

### `settings`

Chave-valor (`key` PK, `value_json`). Um usuário, sem tabela `users`. Chaves:

| chave | valor | padrão |
|---|---|---|
| `fuso_horario` | fuso do "dia" da ofensiva | `America/Sao_Paulo` |
| `tema` | paleta ativa: `tokyo` (E), `borgonha` (G), `verde` (H) | `borgonha` |

Dado de conexão do Google (acesso e renovação) **nunca** vai para o Git; onde
ele fica é decidido no ticket do Google Agenda (A-007).

### `imports` — auditoria da importação

`id`, `file_name`, `file_hash`, `ran_at`, `skills_inserted`, `items_inserted`,
`skipped`, `errors_json`. Permite responder "de onde veio este item".

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
  migration 0001 para isso.

## Seed (`pnpm db:seed`)

Cenário de desenvolvimento, nunca dado real:

- 2 matérias (Cálculo I, Redes), pesos 60/40.
- 8 Ofícios com grafo de pré-requisitos (dois ramos, uma junção).
- 10 itens por Ofício, mistura de ME e cartão, todos com explicação.
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

Índice novo só com a consulta que o justifica.

## O que não está no banco

- Recuperabilidade (calculada pelo FSRS a partir do tempo decorrido).
- Domínio em si (calculado de `proofs`; `proofs` é cache reconstruível).
- **Ofensiva, XP e nível:** derivados de `review_logs` e `proofs` pelo Gregor,
  com os parâmetros em vigor. Sem tabela no MVP; se ficar lento, vira cache
  reconstruível.
- Arquivos binários (ficam em `data/acervo/`).
