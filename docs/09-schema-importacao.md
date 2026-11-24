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

Os campos das provas (ATL-153: `not_applicable` no Ofício; `dimension` e os
campos dela no item; `options` no cartão) também são opcionais no formato, mas
sem eles o Ofício não chega a Dominado e o validador avisa (ver "Mínimos por
Ofício"). `focus` deixou de existir (D-057): arquivo antigo com `focus` é
recusado e precisa ser regerado com `dimension`.

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
| not_applicable | `("fluencia" \| "problemas" \| "explicacao")[]` | opcional, padrão `[]`, sem repetir. Dimensões que não fazem sentido no Ofício (Fluência em Filosofia, por exemplo; D-043). `"conceitual"` e `"autonomia"` são recusados: sempre se aplicam. Vai para `skills.not_applicable_json` |

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
| options | string[4] | obrigatório em ME; opcional em cartão (com alternativas = cartão de alternativas; sem = cartão dissertativo, D-043); proibido em aberta. Exatamente 4; sem alternativa absurda |
| answer | ME e cartão de alternativas: int 0–3 · cartão dissertativo e aberta: string | |
| explanation | string ≥ 20 | **obrigatório**. Diz por que a certa é certa e por que a tentadora é errada |
| difficulty | int 1–3 | opcional |
| dimension | `"conceitual" \| "fluencia" \| "problemas" \| "explicacao"` | opcional; só em exercício (ME ou aberta), nunca em cartão. Diz que prova o item ajuda a conquistar (D-057). Sem `dimension`, o exercício conta só para a Autonomia |
| evidence | `"reconhecimento" \| "interpretacao" \| "representacao" \| "discriminacao"` | obrigatório com `dimension: "conceitual"`, proibido nas outras. `interpretacao` só em ME ("qual reformulação mantém o significado?") |
| category | `"rotineira" \| "nao_rotineira" \| "transferencia"` | obrigatório com `dimension: "problemas"`, proibido nas outras. Transferência = o mesmo conceito num contexto que o Ofício não mostrou |
| expected_seconds | int 1–3600 | opcional, só com `dimension: "fluencia"`. Tempo de quem domina o procedimento; o acerto só conta até 2 vezes esse tempo (C-10). Sem ele, o item não tem relógio |
| followup | string 1–500 | obrigatório com `dimension: "explicacao"`, proibido nas outras. Pergunta complementar, respondida depois da explicação |
| rubric | objeto | obrigatório com `dimension: "explicacao"`, proibido nas outras. Exatamente as chaves `correcao`, `justificativa`, `coerencia`, `aplicacao` e `limitacoes`, cada uma com string 1–300 dizendo o que vale nota 2 **neste** item. Vai para `items.rubric_json` |
| tags | string[] | opcional |
| origin | `"manual" \| "ia"` | |
| reviewed_by_user | boolean | |
| source | `{ material_id \| material, page }` | opcional; `material_id` **ou** `material`, nunca os dois |

Item de explicação é sempre `kind: "aberta"`: o Márcio escreve a explicação, e
a Jane avalia depois pela rubrica (D-043). O `answer` dele é a explicação de
referência que a Jane usa para avaliar.

Regras de conteúdo (da skill): os mínimos por dimensão abaixo mais cartões;
variar tipo; distratores são equívocos reais; sem certeza do fato, não gere o
item e diga no chat.

### Mínimos por Ofício

Quantos itens o Ofício precisa para que cada prova da seção 9 do
`docs/03-gregor.md` seja possível (D-058, **hipótese**). Contam os itens do
arquivo mais os já importados do Ofício, sem os arquivados. Dimensão marcada em
`not_applicable` não é conferida. Faltar não recusa o arquivo: o validador
**avisa** que o Ofício não fecha aquela dimensão.

| dimensão | mínimo | por quê |
|---|---|---|
| Autonomia | 1 exercício (ME ou aberta), com ou sem `dimension` | um acerto válido basta |
| Compreensão conceitual | 4 exercícios conceituais, um de cada `evidence` | 3 de 4 evidências, com a discriminação obrigatória |
| Fluência procedimental | 12 exercícios de fluência | 9 certos nos últimos 10, em 2 dias, 4 por dia |
| Resolução de problemas | 5 problemas: 2 `rotineira`, 2 `nao_rotineira`, 1 `transferencia`. Aviso à parte abaixo de 8 | a rodada usa 5 inéditos; quem reprova gasta os 5, e com menos de 8 sobra pouco para a próxima rodada (10 garantem uma repetição inteira) |
| Explicação | 1 item com `followup` e `rubric` | avaliado pela Jane |

Somando, um Ofício completo tem uns 22 exercícios mais os cartões (padrão da
skill: 8 a 15). Por isso o limite de itens por Ofício subiu (validação 8).

## Validações que recusam o arquivo

1. `version` ≠ 1.
2. ULID inválido ou duplicado dentro do arquivo.
3. `prereqs` com ID inexistente (arquivo + banco).
4. Ciclo no grafo (arquivo + banco).
5. `depth` menor ou igual ao de um pré-requisito da mesma matéria.
6. Item sem `explanation` ou com menos de 20 caracteres.
7. ME sem exatamente 4 `options`; cartão com `options` diferente de 4; aberta
   com `options`; `answer` fora de 0–3 em ME ou cartão de alternativas, ou que
   não é texto no cartão dissertativo e na aberta.
8. Ofício com menos de 3 itens ou mais de 60 (aviso, não erro, entre 3–7 e
   41–60; erro fora disso; D-058).
9. `origin: "manual"` em arquivo com `generated_by` da Jane.
10. Campo `focus` em qualquer item (substituído por `dimension`, D-057);
    `dimension` em cartão.
11. `source` ou recomendação com `material_id` e `material` juntos, ou sem
    nenhum dos dois.
12. `material` que não é link `http(s)://` nem arquivo `.pdf` ou `.md`; nome de
    arquivo com `..`, caminho absoluto ou começando por `data/acervo/`.
13. `material_id` inexistente no banco.
14. `program.name` igual ao de outro curso com ID diferente.
15. Matéria já ligada a outro curso no banco e `program` com outro ID (nada
    muda de curso em silêncio).
16. `study` acima dos limites (tamanho de texto ou número de entradas).
17. Campo de dimensão fora da dimensão dele: `evidence` sem
    `dimension: "conceitual"`, `category` sem `"problemas"`, `expected_seconds`
    sem `"fluencia"`, `followup` ou `rubric` sem `"explicacao"`; ou o campo
    obrigatório faltando na dimensão que o exige.
18. `evidence: "interpretacao"` fora de ME; item de explicação que não é
    `aberta`.
19. `rubric` sem as 5 chaves, com chave a mais ou com texto fora de 1–300.
20. `not_applicable` com `"conceitual"`, `"autonomia"`, valor desconhecido ou
    repetido.

Avisos (não recusam): Ofício sem `description`; `lane` repetido no mesmo
`depth` e matéria (vai sobrepor na Árvore); item com `prompt` igual a outro;
dois materiais cujo `material` só difere em maiúsculas (`Calculo.pdf` e
`calculo.pdf` viram duas entradas). E, das provas (D-058):

- Ofício abaixo de algum mínimo da tabela "Mínimos por Ofício", com a
  dimensão que não fecha e o que falta ("Resolução: falta 1 de transferência").
  O Ofício não chega a Dominado enquanto faltar.
- Ofício com menos de 8 problemas (fecha a dimensão, mas sem folga para uma
  nova rodada).
- Ofício que marca uma dimensão em `not_applicable` e tem itens dela (os itens
  ficam, mas não contam).

## Idempotência

A importação faz **upsert por ID**:

- `skills` e `items` existentes com o mesmo ID são atualizados nos campos de
  conteúdo (`name`, `prompt`, `options`, `answer`, `explanation`, `description`,
  `icon`, `depth`, `lane`, `estimated_minutes`, `not_applicable`,
  `dimension`, `evidence`, `category`, `expected_seconds`, `followup`,
  `rubric` e os campos de `study` presentes no arquivo). Nos campos das
  provas, o item do arquivo é a verdade inteira: campo ausente vira nulo, para
  um item não ficar com a marcação de duas dimensões. `not_applicable` ausente
  mantém o que o Ofício já tinha. `reviewed_by_user` **não** é sobrescrito se já for
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
- A importação de conteúdo nunca toca em `review_logs`, `proofs` e
  `memory_states`. Só a importação de notas da Jane grava em `proofs` (ver
  "Notas da Jane para a Explicação").

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
      "dimension": "fluencia",
      "expected_seconds": 60,
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
      "dimension": "conceitual",
      "evidence": "discriminacao",
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

## Exemplo com as provas

Trecho do Ofício "Regra da cadeia" com um item de cada tipo que as provas pedem:
conceitual (duas evidências), fluência (com `expected_seconds`), problemas
(rotineira e transferência), explicação (com `followup` e `rubric`) e os dois
cartões. É só um trecho: um arquivo real precisa dos mínimos de "Mínimos por
Ofício" (4 conceituais, 12 de fluência, 5 a 10 de problemas) e, importado assim,
o validador **avisaria** das dimensões que ficam abaixo deles, sem recusar. O
Ofício `SK0001` (pré-requisito) já está no banco.

```json
{
  "version": 1,
  "generated_at": "2026-12-02T09:00:00Z",
  "generated_by": "claude-code/atelie-conteudo",
  "subject": {
    "id": "01JCXAM0000000000000SUBJ01",
    "name": "Cálculo I",
    "short_name": "Cálculo",
    "color": "#5b8fd9",
    "icon": "sigma"
  },
  "skills": [
    {
      "id": "01JCXAM0000000000000SK0002",
      "name": "Regra da cadeia",
      "description": "Derivada de função composta: derive a de fora, multiplique pela de dentro.",
      "icon": "link",
      "depth": 2,
      "lane": -0.4,
      "estimated_minutes": 30,
      "prereqs": [
        "01JCXAM0000000000000SK0001"
      ],
      "not_applicable": [],
      "origin": "ia",
      "reviewed_by_user": false
    }
  ],
  "items": [
    {
      "id": "01JCXAM0000000000000IT0011",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "multipla_escolha",
      "dimension": "conceitual",
      "evidence": "reconhecimento",
      "prompt": "Qual destas funções é uma composição de duas funções?",
      "options": [
        "f(x) = 3x² + 1",
        "f(x) = sen(x²)",
        "f(x) = x · sen(x)",
        "f(x) = x² + sen(x)"
      ],
      "answer": 1,
      "explanation": "sen(x²) aplica x² primeiro e depois sen. As outras três combinam funções por soma ou produto, sem aplicar uma dentro da outra; a C parece composição por ter duas funções, mas é um produto.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0012",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "multipla_escolha",
      "dimension": "conceitual",
      "evidence": "discriminacao",
      "prompt": "Qual derivada precisa da regra da cadeia?",
      "options": [
        "d/dx de x⁵",
        "d/dx de x · sen(x)",
        "d/dx de sen(5x)",
        "d/dx de x² + sen(x)"
      ],
      "answer": 2,
      "explanation": "Só sen(5x) tem uma função dentro de outra. A B pede a regra do produto e a D, a da soma; ambas parecem mais complicadas, mas derivam cada fator ou parcela separadamente.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0021",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "aberta",
      "dimension": "fluencia",
      "expected_seconds": 60,
      "prompt": "Derive f(x) = (2x + 1)⁴.",
      "answer": "8(2x + 1)³",
      "explanation": "Fora: 4(2x+1)³. Dentro: a derivada de 2x+1 é 2. O produto dá 8(2x+1)³; esquecer o fator 2 é o erro mais comum.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0031",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "aberta",
      "dimension": "problemas",
      "category": "rotineira",
      "prompt": "Derive f(x) = (x² + 3x)⁶.",
      "answer": "6(x² + 3x)⁵ · (2x + 3)",
      "explanation": "Mesma estrutura do procedimento treinado: fora 6(x²+3x)⁵, dentro 2x+3. Serve para a rodada porque o Ofício já mostrou esse caso.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0032",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "aberta",
      "dimension": "problemas",
      "category": "transferencia",
      "prompt": "Um balão esférico enche a 100 cm³/s. Com que rapidez o raio cresce quando r = 5 cm? (V = 4/3 π r³)",
      "answer": "dr/dt = 1/π cm/s: dV/dt = 4π r² · dr/dt, então 100 = 100π · dr/dt.",
      "explanation": "O Ofício não mostrou taxas relacionadas: o Márcio precisa reconhecer que r depende do tempo e aplicar a regra da cadeia em V(r(t)). Quem só decorou o procedimento não monta a equação.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0041",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "aberta",
      "dimension": "explicacao",
      "prompt": "Explique com suas palavras por que a regra da cadeia multiplica pela derivada da função de dentro.",
      "followup": "E se a função de dentro não for derivável num ponto? O que acontece com a derivada da composta?",
      "answer": "Se y muda dy/du vezes mais rápido que u, e u muda du/dx vezes mais rápido que x, então y muda o produto das duas taxas em relação a x. Se a de dentro não é derivável num ponto, a regra não vale ali e a composta pode não ser derivável.",
      "explanation": "A explicação de referência liga a regra à multiplicação de taxas de variação encadeadas e marca o limite de validade.",
      "rubric": {
        "correcao": "Diz que as taxas se multiplicam, sem confundir com a regra do produto.",
        "justificativa": "Explica por quê, com a ideia de taxas encadeadas (dy/du · du/dx).",
        "coerencia": "Os passos seguem uma ordem lógica, sem contradição.",
        "aplicacao": "Dá ou usa um exemplo concreto, como (3x²+1)⁵.",
        "limitacoes": "Na pergunta complementar, diz que a regra exige a de dentro derivável."
      },
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0051",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "cartao",
      "options": [
        "Derivar a de fora e multiplicar pela derivada da de dentro",
        "Derivar as duas e somar",
        "Derivar as duas e multiplicar",
        "Derivar só a de dentro"
      ],
      "answer": 0,
      "prompt": "Regra da cadeia: o que fazer com f(g(x))?",
      "explanation": "É a multiplicação de taxas encadeadas: f'(g(x)) · g'(x). Derivar as duas e multiplicar esquece de manter a de dentro dentro da de fora.",
      "origin": "ia",
      "reviewed_by_user": false
    },
    {
      "id": "01JCXAM0000000000000IT0052",
      "skill_id": "01JCXAM0000000000000SK0002",
      "kind": "cartao",
      "prompt": "Por que (3x²+1)⁵ não se deriva só como 5(3x²+1)⁴?",
      "answer": "Falta multiplicar pela derivada da de dentro, 6x: o resultado certo é 30x(3x²+1)⁴.",
      "explanation": "O cartão dissertativo pede que o Márcio escreva o erro comum com as próprias palavras antes de ver o verso.",
      "origin": "ia",
      "reviewed_by_user": false
    }
  ]
}
```

## Notas da Jane para a Explicação

A prova Explicação só conta depois que a Jane avalia o texto do Márcio pela
rubrica do item (D-043, D-057). A avaliação é feita fora do app, como o
conteúdo (D-004), em dois arquivos (D-059). Os dois ficam em `imports/`, fora
do Git (D-053), porque um deles leva o texto do Márcio.

### 1. Exportar as pendentes: `pnpm grades:export`

Gera `imports/explicacoes-pendentes-<AAAA-MM-DD>.json` com toda tentativa de
item `dimension: "explicacao"` que ainda não tem linha em `explanation_grades`
e não tem `viewed_solution` (C-05). Sem pendentes, o comando diz isso e não
cria arquivo. O arquivo é só leitura para a Jane: o app não o importa.

```jsonc
{
  "version": 1,
  "type": "explicacoes_pendentes",
  "exported_at": "2026-12-02T21:00:00Z",
  "pending": [
    {
      "review_log_id": "...",   // a tentativa a avaliar
      "reviewed_at": "...",
      "skill_id": "...", "skill_name": "...",
      "item_id": "...",
      "prompt": "...",          // enunciado do item
      "answer": "...",          // explicação de referência da Jane
      "rubric": { ... },        // as 5 chaves, como na importação
      "followup": "...",
      "response": "...",        // o que o Márcio escreveu
      "followup_answer": "..."  // a resposta dele à pergunta complementar
    }
  ]
}
```

### 2. Importar as notas: `pnpm import:validate` e `pnpm import:run`

A Jane lê o arquivo de pendentes, avalia cada texto e grava
`imports/notas-explicacao-<AAAA-MM-DD>.json`. Os mesmos comandos da importação
de conteúdo (e a tela Importar) leem os dois tipos de arquivo pelo campo
`type`: arquivo sem `type` é de conteúdo, como sempre foi.

| campo | tipo | regra |
|---|---|---|
| version | `1` | |
| type | `"notas_explicacao"` | obrigatório |
| generated_at | ISO datetime | vira o `graded_at` de cada nota |
| generated_by | string | `"claude-code/atelie-conteudo"` |
| grades | objeto[] | ao menos 1 |
| grades[].id | ULID | gerado pela Jane, **estável**: ao regerar o arquivo, reutilize |
| grades[].review_log_id | ULID | a tentativa avaliada |
| grades[].correcao, justificativa, coerencia, aplicacao, limitacoes | int 0–2 | as 5 notas da rubrica |
| grades[].feedback | string ≤ 1000 | opcional; o que o Márcio deve melhorar, em uma ou duas frases |

O arquivo de notas **não** repete o texto do Márcio nem o enunciado: só IDs,
notas e comentário. Se a nota aprova (8 de 10, Correção e Justificativa em 2)
é conta do Gregor, não da Jane (`docs/03-gregor.md`, seção 9).

**Recusa o arquivo:**

1. `version` ≠ 1 ou `type` desconhecido.
2. ULID inválido, `id` repetido ou `review_log_id` repetido no arquivo.
3. `review_log_id` inexistente, de item que não é `explicacao`, ou de
   tentativa com `viewed_solution`.
4. Nota fora de 0–2, que não é inteiro, ou faltando; `feedback` acima de 1000.
5. Tentativa que já tem nota com **outro** `id` (a nota é imutável: para
   reavaliar, o Márcio faz outra tentativa).
6. `id` já importado com outro `review_log_id` ou com outras notas.

**Idempotência:** `id` já importado com o mesmo `review_log_id` e as mesmas
notas é pulado sem erro. Rodar o mesmo arquivo duas vezes não muda nada; a
segunda execução registra tudo como `skipped` em `imports`.

**O que a importação grava**, numa transação só: as linhas novas de
`explanation_grades` (com o `import_id` do arquivo); depois, para cada Ofício
que recebeu nota, chama `evaluateProofs` e grava em `proofs` a prova que
passou a valer (`earned_at` = momento da importação, D-057). Qualquer erro
reverte o arquivo inteiro. O resultado vai para `imports` com
`kind = 'notas_explicacao'`.

### Exemplo de arquivo de notas

```json
{
  "version": 1,
  "type": "notas_explicacao",
  "generated_at": "2026-12-02T21:30:00Z",
  "generated_by": "claude-code/atelie-conteudo",
  "grades": [
    {
      "id": "01JCXGRD000000000000GRD001",
      "review_log_id": "01JCXLOG000000000000LOG001",
      "correcao": 2,
      "justificativa": 2,
      "coerencia": 2,
      "aplicacao": 1,
      "limitacoes": 1,
      "feedback": "Boa justificativa pela multiplicação das taxas. Faltou dizer quando a regra não se aplica (função de dentro não derivável)."
    }
  ]
}
```

Soma 8 de 10, com Correção e Justificativa em 2: pelo critério da seção 9 do
`docs/03-gregor.md`, essa nota conquista a prova Explicação.

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
