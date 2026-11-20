# 07 · Glossário

Nomes do Ateliê. Use-os no código (comentários, nomes de domínio), nos
documentos e no chat. Nomes técnicos em inglês entre parênteses são os
identificadores no código.

## Peças do sistema

**Ateliê** — o sistema inteiro. Oficina onde se aprende um ofício.

**Gregor** (`core`, `planner`) — o motor (antigo Curador). Decide o que estudar
agora, calcula domínio, ofensiva e XP, por regras, de forma determinística.
Nunca gera conteúdo, nunca usa IA.

**Jane** — o Claude dentro do Ateliê (antiga Mestre). Decompõe matérias, gera
itens, explica, dá pista, corrige escrita. Na v1 opera por Claude Code +
importação; chat embutido fica para depois do MVP.

**Acervo** (`materials`) — a biblioteca: PDFs, vídeos, links, notas e markdown,
cada um ligado a um ou mais Ofícios. Ler não sobe domínio. A aba da UI se chama
**Biblioteca**.

**Bancada** — a prática: fila de provas e cartões. A aba da UI se chama
**Praticar**. Onde o domínio é conquistado.

**Árvore** — mapa visual dos Ofícios com pré-requisitos, em leque radial por
matéria. Mostra estado, dimensões provadas e "precisa revisar". Fica dentro da
aba Ficha. Não é linha do tempo.

## As abas

**Painel** — antiga aba Hoje. A sessão do dia sugerida pelo Gregor, ofensiva,
nível e XP, revisões vencidas, mini evolução.

**Planejar** — grade da semana com Google Agenda.

**Biblioteca** — Materiais e Importar.

**Praticar** — Fila de hoje (provas) e Cartões.

**Ficha** — resumo do estudante (nível, XP, ofensiva, domínio por matéria) e a
Árvore.

## Conteúdo

**Matéria** (`subject`) — área de estudo: Cálculo I, Redes, A República. Tem
cor, peso e, opcionalmente, prazo de prova.

**Ofício** (`skill`) — unidade de conhecimento testável em 10 a 40 minutos. Nó
da Árvore. Tem pré-requisitos, provas e domínio. Capítulos de livros de leitura
viram Ofícios.

**Pré-requisito** (`prereq`) — dependência real entre Ofícios: não dá para
fazer B sem A. Não é ordem de apostila. O grafo é acíclico.

**Item** (`item`) — questão de múltipla escolha, cartão ou questão aberta,
ligado a um Ofício. Sempre tem explicação.

**Cartão** (`kind: 'cartao'`) — item de frente e verso, usado em revisões.

**Importação** (`import`) — o único caminho de entrada de conteúdo: JSON
validado por Zod, idempotente por ULID.

## Prática e memória

**Dimensão** — cada uma das 5 formas de provar que se domina um Ofício:
**Compreensão conceitual**, **Fluência procedimental**, **Resolução de
problemas**, **Autonomia** (sem consultar) e **Explicação**. Inspiradas na
taxonomia de Bloom, mas é um desenho do produto.

**Prova** (`proof`) — evidência de domínio conquistada numa tentativa válida.
Uma prova por dimensão, por Ofício. Identificadores: `conceitual`, `fluencia`,
`problemas`, `autonomia`, `explicacao`. Sexta, para humanas, depois do MVP:
**Escrita**.

**Tentativa** (`review_log`) — uma resposta registrada, certa ou errada. O
registro bruto. Nunca é editado ou apagado.

**Tentativa válida** — tentativa sem `viewed_solution`. Só estas contam para
domínio, XP e reforço. Todas contam para a ofensiva.

**Retoque** (`retoque`, `memory_states.due_at`) — revisão espaçada de um item,
agendada pelo FSRS. "Retoques vencidos" são os que passaram do `due_at`.

**Sessão do dia** (`session`) — o plano que o Gregor monta, em 4 blocos fixos:
Revisão pré-matéria (mini exercícios), Estudo da matéria nova, Reforço em
pontos fracos e Revisão com cartões. Dois modos: **Completa** e **Curta**.

**Reforço** — fila de Ofícios com erro recente, praticados no bloco 3.

**Domínio** (`mastery.dimensions`) — de 0 a 5: quantas dimensões foram provadas
no Ofício. Vem só de provas.

**Confiança** (`mastery.confidence`) — de 0 a 1: domínio dividido por 5, menos
uma pequena penalidade por erro recente. O erro baixa a confiança, nunca o
domínio.

**Estados do Ofício** — **Bloqueado** (algum pré-requisito ainda não Liberado),
**Disponível** (0 dimensões), **Em prática** (1, ou 2 ou mais sem a Compreensão
conceitual), **Liberado** (2 ou mais, uma delas a Compreensão conceitual; abre
os dependentes), **Dominado** (todas as dimensões que se aplicam).

**Precisa revisar** — marcador de um Ofício com prova cuja recuperabilidade
média caiu abaixo da meta de retenção (`RETENTION_TARGET`). Não apaga prova.

**Desbloqueio** — um Ofício abre quando cada pré-requisito tem pelo menos 2
dimensões diferentes provadas, uma delas a Compreensão conceitual (está Liberado
ou Dominado).

## Planejamento

**Motivo** (`reason`) — frases em português que explicam cada item da sessão.
Obrigatório.

**Decomposição** (`breakdown`) — os números de cada critério de ordenação.
Obrigatório, para auditoria.

**Peso** (`subject.weight`) — importância relativa da matéria, definida pelo
usuário. Soma 100.

## Gamificação

**Ofensiva** (`streak`) — dias seguidos com ao menos uma tentativa registrada,
certa ou errada (antes "sequência"). Ler não conta. Fuso de São Paulo.

**XP** — pontos por acerto válido, prova conquistada e cartão avaliado. Erro
não dá XP.

**Nível** (`level`) — derivado do XP total. Benefícios por nível ficam para
depois.

## Visual

**Paleta** — conjunto de tokens de cor. Três, todas escuras e trocáveis: **E**
(Tokyo e âmbar), **G** (Borgonha e ouro, a padrão) e **H** (Verde e ouro).

**Token** — nome semântico de cor (`bg`, `surface`, `text`, `accent`...) usado
nos componentes. Cada paleta dá um valor a cada token.

## Documentação e processo

**Épico, História, Subtarefa** — níveis do Jira (chave `ATL`).

**Hipótese** — número ou regra sem base empírica verificada. Marcado assim em
`params.ts` e em `docs/02-ciencia.md`.

**Decisão** (D-xxx) — entrada em `docs/06-decisoes.md`.

## Nomes que não usamos

- "Curador" → Gregor. "Mestre" → Jane. "Hoje" → Painel. "Streak" ou
  "sequência" → Ofensiva. (Só aparecem em `docs/historico/` e nas decisões
  D-001 a D-019, que mantêm o texto original.)
- "Tópico" → Ofício.
- "Habilidade" → Ofício (a Árvore é "de Ofícios", não "de habilidades").
- "Flashcard" → Cartão.
- "Revisão espaçada" → Retoque (o conceito é o mesmo; o nome é do Ateliê).
- "IA" para o Gregor. O Gregor é um motor de regras.
