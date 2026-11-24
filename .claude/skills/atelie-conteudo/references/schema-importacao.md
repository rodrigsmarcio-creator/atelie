# 09 · Schema de importação

Formato do JSON que a Jane gera e o Ateliê importa. É o **único** caminho de
entrada de conteúdo (D-004). A skill `atelie-conteudo` espera este arquivo em
`references/schema-importacao.md` dentro da própria pasta da skill: copie este
documento para lá e mantenha os dois iguais.

Validação: Zod em `packages/db/src/import/schema.ts`. O que está escrito aqui
é o que o Zod implementa; se divergirem, o Zod está errado.

## Arquivo

`imports/<materia>-<AAAA-MM-DD>.json`, UTF-8, um objeto na raiz.

```jsonc
{
  "version": 1,
  "generated_at": "2026-11-16T09:00:00Z",
  "generated_by": "claude-code/atelie-conteudo",
  "program": { ... },   // opcional
  "subject": { ... },
  "skills": [ ... ],
  "items": [ ... ]
}
```

Tudo o que o ATL-123 acrescentou (`program`, `source.material` e `study`) é
opcional: arquivo sem esses campos funciona como antes, e `version` continua 1.

## `program` — curso (opcional)

Curso da grade de referência de onde a matéria saiu (D-045, D-046). Sem tela
no MVP; fica no banco para o mini curso (ATL-120).

| campo | tipo | regra |
|---|---|---|
| id | ULID | obrigatório. Reutilizar o ID do curso já importado para ligar outra matéria a ele |
| name | string 1–80 | único |
| reference | string 1–200 | grade de referência em texto livre: curso, instituição e ano ("Direito, USP, grade 2025") |

Com `program` no arquivo, a matéria do arquivo fica ligada a esse curso
(`subjects.program_id`). Sem `program`, a ligação que já existir no banco é
mantida.

## `subject`

| campo | tipo | regra |
|---|---|---|
| id | ULID | obrigatório. Reutilizar o ID de uma matéria existente para adicionar Ofícios a ela |
| name | string 1–80 | único |
| short_name | string ≤ 20 | opcional |
| color | `#rrggbb` | |
| icon | string | id de ícone da UI |
| weight | int 0–100 | opcional; se omitido, mantém o atual ou 0 |
| exam_at | ISO date | opcional |

## `skills[]` — Ofícios

| campo | tipo | regra |
|---|---|---|
| id | ULID | obrigatório, estável entre execuções (idempotência) |
| name | string 1–80 | único dentro da matéria |
| label | string ≤ 24 | opcional; rótulo curto para a Árvore |
| description | string ≤ 300 | uma ou duas frases: o que é, por que importa |
| icon | string | |
| depth | int ≥ 1 | profundidade no leque; raiz = 1 |
| lane | number −1..1 | posição lateral no setor; 0 = centro |
| estimated_minutes | int 10–40 | tempo de uma sessão de prática |
| prereqs | ULID[] | IDs de Ofícios deste arquivo ou já existentes, inclusive de outra matéria. Grafo acíclico |
| origin | `"manual" \| "ia"` | a Jane sempre escreve `"ia"` |
| reviewed_by_user | boolean | a Jane sempre escreve `false` |
| source | `{ material_id: ULID \| material: string, page_from?: int, page_to?: int }` | opcional; obrigatório quando gerado de material do Acervo. `material_id` **ou** `material`, nunca os dois (ver "Materiais por nome"). As páginas vão para `material_skills` |
| study | objeto | opcional; texto de estudo da fase Aprender (ver "Texto de estudo") |

Regras de decomposição (da skill): testável em 10–40 min; pré-requisito é
dependência real, não ordem de apostila, e é criado **por padrão**, inclusive
entre matérias (D-044): omite-se a aresta só em caso isolado, e a Jane lista no
chat as de que tem menos certeza; `depth` de um Ofício ≥ max(depth dos
pré-requisitos **da mesma matéria**) + 1. Aresta para Ofício de outra matéria
não mexe no `depth`, porque o `depth` serve ao leque de cada matéria (D-053).

### Texto de estudo (`study`)

Lido na fase Aprender, antes da primeira tentativa (D-052). Ler **não gera
tentativa**: não dá XP, não conta para a ofensiva e não sobe domínio. Todos os
campos são opcionais. Limites são **hipótese** (D-056).

| campo | tipo | regra |
|---|---|---|
| explanation | string markdown ≤ 6000 | a explicação do Ofício |
| recommendations | `{ material_id \| material, page_from?, page_to?, note? }[]`, até 10 | o que ler e onde; `material` segue "Materiais por nome"; `note` ≤ 200 diz por que ler |
| guidance | string markdown ≤ 2000 | orientações: como estudar, o que observar, erros a evitar |
| faq | `{ question: string ≤ 200, answer: string ≤ 1000 }[]`, até 10 | dúvidas comuns |

No banco: `skills.study_explanation`, `study_recommendations_json`,
`study_guidance` e `study_faq_json` (`docs/04-dados.md`). Em
`study_recommendations_json` o `material` já vem trocado pelo `material_id`.

### Materiais por nome (`source.material`)

Em `skills[].source`, `items[].source` e `study.recommendations[]`, o material
pode ser citado pelo `material_id` (já cadastrado) **ou** pelo `material`
(D-049):

- **nome de arquivo** relativo a `data/acervo/`, sem esse prefixo, com `/` entre
  pastas: `"Stewart - Calculo vol 1.pdf"`, `"direito/constituicao.md"`;
- **link** `http://` ou `https://`.

A importação procura o material por `path` (arquivo) ou `url` (link) e, se não
existir, cria a entrada na Biblioteca com o tipo deduzido: `.pdf` → `pdf`,
`.md` → `markdown`, link → `link`. O título é o nome do arquivo sem extensão,
ou o próprio link. O mesmo material citado em vários Ofícios vira **uma**
entrada só. PDF e markdown são **só referência**: o arquivo fica no PC e não vai
para o banco nem para a nuvem (D-050). Vídeo está fora do MVP.

## `items[]` — questões e cartões

| campo | tipo | regra |
|---|---|---|
| id | ULID | obrigatório, estável |
| skill_id | ULID | precisa existir no arquivo ou no banco |
| kind | `"multipla_escolha" \| "cartao" \| "aberta"` | |
| prompt | string 1–1000 | enunciado ou frente do cartão |
| options | string[4] | obrigatório se ME; exatamente 4; sem alternativa absurda |
| answer | ME: int 0–3 · cartão/aberta: string | |
| explanation | string ≥ 20 | **obrigatório**. Diz por que a certa é certa e por que a tentadora é errada |
| difficulty | int 1–3 | opcional |
| focus | `"conceitual"` | opcional. Marca o item que testa o conceito (o porquê, não só o como); acerto nele conquista a prova Compreensão conceitual. Só vale em exercício (ME ou aberta); em cartão é aceito, mas não conquista prova (D-037) |
| tags | string[] | opcional |
| origin | `"manual" \| "ia"` | |
| reviewed_by_user | boolean | |
| source | `{ material_id \| material, page }` | opcional; `material_id` **ou** `material`, nunca os dois |

Regras de conteúdo (da skill): 8–15 itens por Ofício; variar tipo; distratores
são equívocos reais; sem certeza do fato, não gere o item e diga no chat.

## Validações que recusam o arquivo

1. `version` ≠ 1.
2. ULID inválido ou duplicado dentro do arquivo.
3. `prereqs` com ID inexistente (arquivo + banco).
4. Ciclo no grafo (arquivo + banco).
5. `depth` menor ou igual ao de um pré-requisito da mesma matéria.
6. Item sem `explanation` ou com menos de 20 caracteres.
7. ME sem exatamente 4 `options`, ou `answer` fora de 0–3.
8. Ofício com menos de 3 itens ou mais de 20 (aviso, não erro, entre 3–7 e
   16–20; erro fora disso).
9. `origin: "manual"` em arquivo com `generated_by` da Jane.
10. `focus` com valor diferente de `"conceitual"`.
11. `source` ou recomendação com `material_id` e `material` juntos, ou sem
    nenhum dos dois.
12. `material` que não é link `http(s)://` nem arquivo `.pdf` ou `.md`; nome de
    arquivo com `..`, caminho absoluto ou começando por `data/acervo/`.
13. `material_id` inexistente no banco.
14. `program.name` igual ao de outro curso com ID diferente.
15. Matéria já ligada a outro curso no banco e `program` com outro ID (nada
    muda de curso em silêncio).
16. `study` acima dos limites (tamanho de texto ou número de entradas).

Avisos (não recusam): Ofício sem `description`; `lane` repetido no mesmo
`depth` e matéria (vai sobrepor na Árvore); item com `prompt` igual a outro;
Ofício sem nenhum exercício com `focus: "conceitual"` (ele não chega a
Dominado, D-037); dois materiais cujo `material` só difere em maiúsculas
(`Calculo.pdf` e `calculo.pdf` viram duas entradas).

## Idempotência

A importação faz **upsert por ID**:

- `skills` e `items` existentes com o mesmo ID são atualizados nos campos de
  conteúdo (`name`, `prompt`, `options`, `answer`, `explanation`, `description`,
  `icon`, `depth`, `lane`, `estimated_minutes`, `focus` e os campos de `study`
  presentes no arquivo). `reviewed_by_user` **não** é sobrescrito se já for
  `true`.
- `prereqs` são substituídos pelo conjunto do arquivo (para o Ofício presente
  no arquivo).
- `program` é upsert por ID (`name`, `reference`). Sem `program` no arquivo, a
  matéria mantém o curso que já tinha.
- Materiais citados por `material` casam por `path` ou `url`, não por ULID: a
  segunda importação reencontra a mesma entrada e não cria outra.
- Campo opcional omitido (`program`, `source`, `study` ou um campo dentro de
  `study`) **não apaga** o que já está no banco.
- Nada é apagado. Para retirar um item, arquive pela UI (`archived_at`).
- `review_logs`, `proofs` e `memory_states` nunca são tocados pela importação.

Tudo numa transação. Qualquer erro reverte o arquivo inteiro. O resultado vai
para a tabela `imports`.

## Exemplo mínimo

```json
{
  "version": 1,
  "generated_at": "2026-11-16T09:00:00Z",
  "generated_by": "claude-code/atelie-conteudo",
  "subject": {
    "id": "01JCXAM0000000000000SUBJ01",
    "name": "Cálculo I",
    "short_name": "Cálculo",
    "color": "#5b8fd9",
    "icon": "sigma",
    "weight": 40,
    "exam_at": "2026-11-22"
  },
  "skills": [
    {
      "id": "01JCXAM0000000000000SK0001",
      "name": "Derivadas",
      "description": "Definição pela reta tangente, regras básicas, produto e quociente.",
      "icon": "func",
      "depth": 1,
      "lane": 0,
      "estimated_minutes": 30,
      "prereqs": [],
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000SK0002",
      "name": "Regra da cadeia",
      "description": "Derivada de função composta: derive a de fora, multiplique pela de dentro.",
      "icon": "link",
      "depth": 2,
      "lane": -0.4,
      "estimated_minutes": 30,
      "prereqs": ["01JCXAM0000000000000SK0001"],
      "origin": "ia",
      "reviewed_by_user": false,
      "source": { "material_id": "01JCXAM0000000000000MAT001", "page_from": 198, "page_to": 210 }
    }
  ],
  "items": [
    {
      "id": "01JCXAM0000000000000IT0001",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "multipla_escolha",
      "prompt": "Calcule a derivada de f(x) = (3x² + 1)⁵.",
      "options": ["5(3x² + 1)⁴", "30x(3x² + 1)⁴", "15x(3x² + 1)⁴", "6x(3x² + 1)⁵"],
      "answer": 1,
      "explanation": "Fora: 5(3x²+1)⁴. Dentro: a derivada de 3x²+1 é 6x. O produto dá 30x(3x²+1)⁴. A alternativa A esquece de multiplicar pela derivada de dentro, que é o erro mais comum.",
      "difficulty": 2,
      "origin": "ia",
      "reviewed_by_user": false,
      "source": { "material_id": "01JCXAM0000000000000MAT001", "page": 201 }
    },
    {
      "id": "01JCXAM0000000000000IT0003",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "multipla_escolha",
      "focus": "conceitual",
      "prompt": "Por que a regra da cadeia multiplica pela derivada da função de dentro?",
      "options": ["Porque a derivada de um produto é o produto das derivadas", "Porque taxas de variação encadeadas se multiplicam: dy/dx = dy/du · du/dx", "Porque a função de dentro é sempre linear", "Por convenção, para simplificar a conta"],
      "answer": 1,
      "explanation": "Se y muda dy/du vezes mais rápido que u, e u muda du/dx vezes mais rápido que x, então y muda o produto das duas taxas em relação a x. A alternativa A confunde com a regra do produto, que não é o produto das derivadas.",
      "difficulty": 2,
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0002",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "cartao",
      "prompt": "Regra da cadeia em uma frase",
      "answer": "Derive a função de fora mantendo a de dentro, depois multiplique pela derivada da de dentro.",
      "explanation": "É a multiplicação de taxas de variação encadeadas: se y depende de u e u depende de x, dy/dx = dy/du · du/dx.",
      "origin": "ia",
      "reviewed_by_user": false
    }
  ]
}
```

## Exemplo com curso, material por nome e texto de estudo

Trecho: só o que muda em relação ao exemplo mínimo. `items` está vazio para
encurtar; um arquivo real precisa de 3 a 20 itens por Ofício. O pré-requisito
`SK0900` é um Ofício já importado de outra matéria do mesmo curso.

```json
{
  "version": 1,
  "generated_at": "2026-11-24T09:00:00Z",
  "generated_by": "claude-code/atelie-conteudo",
  "program": {
    "id": "01JCXD00000000000000PRG001",
    "name": "Direito",
    "reference": "Direito, USP, grade 2025"
  },
  "subject": {
    "id": "01JCXD00000000000000SBJ001",
    "name": "Direito Constitucional I",
    "short_name": "Constitucional",
    "color": "#b5835a",
    "icon": "scale"
  },
  "skills": [
    {
      "id": "01JCXD00000000000000SK0001",
      "name": "Poder constituinte",
      "description": "Quem cria a Constituição, com que limites, e a diferença entre poder originário e derivado.",
      "icon": "quill",
      "depth": 1,
      "lane": 0,
      "estimated_minutes": 30,
      "prereqs": ["01JCXD00000000000000SK0900"],
      "origin": "ia",
      "reviewed_by_user": false,
      "source": { "material": "direito/Lenza - Direito Constitucional.pdf", "page_from": 180, "page_to": 196 },
      "study": {
        "explanation": "O **poder constituinte originário** cria a Constituição e não tem limite jurídico anterior. O **derivado** altera a Constituição dentro das regras que ela mesma fixa.",
        "recommendations": [
          { "material": "direito/Lenza - Direito Constitucional.pdf", "page_from": 180, "page_to": 196, "note": "Capítulo base do Ofício." },
          { "material": "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm", "note": "Art. 60: limites ao poder de reforma." }
        ],
        "guidance": "Leia o capítulo antes do art. 60 e compare as cláusulas pétreas com os limites formais.",
        "faq": [
          { "question": "Emenda constitucional é poder originário?", "answer": "Não. Emenda é poder derivado reformador e precisa respeitar o art. 60, inclusive as cláusulas pétreas." }
        ]
      }
    }
  ],
  "items": []
}
```

O mesmo PDF aparece em `source` e em `recommendations` e vira **uma** entrada
na Biblioteca (`kind: "pdf"`, `path` igual ao nome); o link vira outra
(`kind: "link"`).

## Fluxo com o Claude Code

1. `claude` no repositório, pedir: "adiciona Redes de Computadores" (a skill
   `atelie-conteudo` dispara).
2. A Jane pergunta escopo se precisar, gera `imports/redes-2026-11-16.json`.
3. `pnpm import:validate imports/redes-2026-11-16.json`.
4. `pnpm import:run imports/redes-2026-11-16.json`, ou, na aba Biblioteca →
   Importar, enviar o mesmo `.json` (passa pelo mesmo validador).
5. Conferir por amostragem os itens que a Jane apontou como duvidosos;
   marcar `reviewed_by_user` pela UI.

O JSON **não vai para o Git**: conteúdo real fica fora do repositório público
(D-034), e `imports/` está no `.gitignore` (só o `README.md` é versionado). O
histórico do conteúdo é o banco.
