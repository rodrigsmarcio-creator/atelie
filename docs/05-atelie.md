# 05 · Telas e identidade visual

Referência de fluxo e visual para `apps/web`. Cobre as cinco abas do MVP, o
visual novo (três paletas escuras trocáveis) e o que aproveitar do protótipo
antigo.

## Fontes de referência

- **Visual novo:** página de comparação das três paletas
  (https://claude.ai/artifact/D7WcPfUGme2wxEX3uEeKXs). É referência de cor e de
  atmosfera. O protótipo definitivo (HTML, no PC primeiro) é feito no épico de
  identidade visual, antes do front, e aprovado pelo Márcio.
- **Protótipo antigo** (`docs/historico/prototipo-antigo/index.html`, HTML único
  com Tailwind CDN): serve só para o **fluxo** e para a **geometria da Árvore**.
  O visual dele (tinta escura e bronze) foi descartado. Não editar.

## Identidade visual (D-025)

O app inteiro tem visual novo. **Só modo escuro.** Três paletas trocáveis, por
tokens semânticos; a escolha fica em `settings.tema` e vale em todos os
aparelhos. Padrão: **G**.

| Paleta | `settings.tema` | Ideia |
|---|---|---|
| **E** | `tokyo` | Tokyo Night com âmbar; cartões pretos |
| **G** | `borgonha` | Borgonha e ouro; a padrão |
| **H** | `verde` | Verde escuro (estilo Spotify) com detalhes dourados e cartões pretos |

### Tokens

Nomes definitivos dos tokens (Tailwind, via variáveis CSS trocadas por
`data-theme` no `<html>`). Os componentes só usam estes nomes.

| Token | Uso | E | G | H |
|---|---|---|---|---|
| `bg` | fundo da página | `#140E2B` | `#0D0D0D` | `#0D1B15` |
| `surface` | cartões | `#060606` | `#17110F` | `#060606` |
| `surface-2` | cartão elevado, hover | `#15111F` | `#241A17` | `#141414` |
| `line` | bordas | `#2E2559` | `#3A2C26` | `#27302B` |
| `text` | texto | `#F3ECFF` | `#EFE5D2` | `#F7F4EA` |
| `muted` | texto secundário | `#A99BC9` | `#B8AC98` | `#A9B8B0` |
| `accent` | ação primária | `#FF7EE3` | `#C28D39` | `#1ED760` |
| `on-accent` | texto sobre `accent` | `#16081A` | `#0D0D0D` | `#06130C` |
| `hot` | ofensiva (decorativo) | `#EA6113` | `#710912` | `#A37E2C` |
| `hot-2` | ofensiva (brilho) | `#FBB931` | `#C28D39` | `#E8CF8A` |
| `xp` | XP e nível | `#FBB931` | `#C28D39` | `#D9B45F` |
| `halo` | brilho de fundo | `rgba(91,42,134,.6)` | `rgba(113,9,18,.55)` | `rgba(0,112,74,.5)` |
| `glow` | brilho de destaque | `rgba(248,143,34,.7)` | `rgba(194,141,57,.6)` | `rgba(217,180,95,.6)` |

Iguais nas três: `ok` `#6FD9A0` (sucesso), `bad` `#FF7B6B` (risco, erro).

Tokens de detalhe (D-040): `ring` (anel do nível) e `eyebrow` (etiqueta em
maiúsculas, que é texto) são o próprio `xp` de cada paleta; `hairline` (filete
de 1 px) é o `xp` a 55% de opacidade. Não são colunas novas da tabela acima: o
valor sai do `xp`. O `eyebrow` herda os pares de contraste do `xp` (mínimo 5,80,
na G).

| Paleta | `hairline` | `ring` e `eyebrow` |
|---|---|---|
| E | `rgba(251,185,49,.55)` | `#FBB931` |
| G | `rgba(194,141,57,.55)` | `#C28D39` |
| H | `rgba(217,180,95,.55)` | `#D9B45F` |

A H também tem logo em gradiente dourado (`#A37E2C` a `#E8CF8A`).

#### Ornamentos

Cada paleta tem um **símbolo do nível**, na cor do `xp`, mais o filete
(`hairline`, uma linha de CSS, sem arquivo). Os símbolos são SVG de
`viewBox 0 0 24 16`, com `currentColor`, em `docs/assets/ornamentos/`:

| Paleta | Símbolo | Arquivo |
|---|---|---|
| E | Estrela de quatro pontas com duas faíscas | `ornamento-e.svg` |
| G | Coroa de louros | `ornamento-g.svg` |
| H | Coroa | `ornamento-h.svg` |

Usar a partir de 20 px de largura: em 16 px os louros da G perdem detalhe. A
página `docs/assets/teste-tipografia.html` mostra os três nas próprias paletas.
É referência visual: a tabela de tokens deste doc é a fonte da verdade.

Os valores de G e H partem de marcas de referência (borgonha e ouro; verde de
streaming e dourado de relógio). Foram revistos e **fechados na ATL-53**, sem
mudança: todos passam no contraste (tabela abaixo) e o Márcio aprovou o visual
na página de comparação (D-039).

Regras:

- Cada matéria tem uma cor própria usada só para identificar a matéria: ponto,
  tag, leque da Árvore. Nunca para estado.
- **Contraste mínimo 4,5:1 para texto, em cada paleta**, com teste automático
  no CI (`text` e `muted` sobre `bg`, `surface` e `surface-2`; `on-accent` sobre
  `accent`). Tokens decorativos (`hot`, `halo`, `glow`) **nunca** são texto: na
  paleta G, o borgonha e o espresso não passam como texto sobre `bg`.
- `line` é **decorativa** (1,3 a 1,5:1 sobre `bg` e `surface`): separa cartões,
  mas não identifica controle. Borda de campo de texto, caixa de seleção ou
  outro controle que só se reconhece pela borda usa `muted` (WCAG 1.4.11 pede
  3:1; `muted` dá mais de 7:1 nas três).
- `prefers-reduced-motion` desliga os brilhos (`halo`, `glow`) e animações.

#### Contraste medido

Gerado por `node scripts/contraste.ts`, que lê a tabela de tokens deste doc e
falha se algum par ficar abaixo de 4,5:1. Os sete primeiros pares são os
exigidos; os quatro últimos são tokens que aparecem como texto em telas. Medido
em 2026-11-20 (ATL-53).

| Par | E | G | H |
|---|---|---|---|
| `text` sobre `bg` | 16,19 | 15,56 | 16,11 |
| `text` sobre `surface` | 17,61 | 14,96 | 18,41 |
| `text` sobre `surface-2` | 16,13 | 13,61 | 16,74 |
| `muted` sobre `bg` | 7,29 | 8,69 | 8,58 |
| `muted` sobre `surface` | 7,93 | 8,36 | 9,81 |
| `muted` sobre `surface-2` | 7,26 | 7,60 | 8,92 |
| `on-accent` sobre `accent` | 8,62 | 6,63 | 9,89 |
| `accent` sobre `surface-2` | 8,26 | 5,80 | 9,60 |
| `xp` sobre `surface-2` | 10,68 | 5,80 | 9,34 |
| `ok` sobre `surface-2` | 10,70 | 9,80 | 10,62 |
| `bad` sobre `surface-2` | 7,33 | 6,72 | 7,28 |

O par mais apertado é o ouro da G (`accent` e `xp` sobre `surface-2`, 5,80).
Se a G mudar, conferir esse primeiro.

### Tipografia

Fonte **atrelada à paleta** (D-025, fechada pela D-040): a G usa Libre Baskerville
**só nos títulos e nos números grandes** e Montserrat no texto; E e H usam
Montserrat em tudo. Texto pequeno (chips, opções de prova, tabelas) fica sempre
em Montserrat. Roboto Flex fica como alternativa de texto corrido. A Gotham HTF
tem licença comercial e não é usada; Montserrat é o substituto livre.

Cantos e formas, pelo protótipo novo.

### Componentes base

`Card`, `Button` (primary/ghost/quiet), `Chip`, `Eyebrow`, `Bar`, `Tag`,
`IconBtn`, `StatCard`, `ProgressRing`, `Toast`, mais os de gamificação (anel de
ofensiva, barra de XP, coroa do nível). Um arquivo cada em
`apps/web/components/ui`.

## Estrutura de navegação

```
[rail]      Painel · Planejar · Biblioteca · Praticar · Ficha
[menu]      itens da aba ativa (some quando a aba tem um item só)
[tela]      conteúdo
```

Sidebar dupla: o rail nunca muda; o menu contextual muda com a aba. No celular,
o rail vira barra inferior e o menu vira gaveta. Configuração (paleta, Google
Agenda) abre por um botão fixo.

## As telas (MVP)

### Painel

1. **Sessão do dia** (Gregor): os 4 blocos com minutos e motivo, modo
   **Completa** ou **Curta**, e o botão **Começar** (executa o bloco 1; os
   outros são fila). Bloco vazio aparece pulado, com o motivo.
2. Ofensiva (dias seguidos), nível e XP com barra.
3. Revisões vencidas (itens e cartões) e Ofícios que "precisam revisar".
4. Mini evolução: domínio geral e por matéria.

Funcionamento mínimo: sem agenda do dia, sem missões, sem captura rápida.

### Planejar

Grade da semana com os eventos do Google Agenda e a ação **"Planejar sessão"**:
o Márcio escolhe o dia e a hora de início e o app cria **um** evento com os 4
blocos na descrição. O Gregor não escolhe horário.

### Biblioteca

**Materiais** (lista, ligação a Ofícios) e **Importar** (`.json` pelo validador;
`.md` guardado até a Jane converter), com as instruções do fluxo. A tela
**Livros** fica fora do MVP e será criada depois.

### Praticar

**Fila de hoje**: Ofícios com as 5 dimensões como barras de **progresso**
(ex.: "7 de 10", "2 de 3 evidências"); botão **Resolver** abre o modal de prova.
**Cartões**: o Márcio responde (alternativas ou texto) antes de ver o verso e
depois dá a nota (Errei, Difícil, Bom, Fácil), com teto vindo do resultado; o XP
vem das tentativas (D-043). O modal de prova implementa as regras de C-05, C-06,
C-07, C-08 e C-10 de `docs/02-ciencia.md` e os critérios da D-043: ver a solução
invalida, resposta rápida pede raciocínio (só na Autonomia), Explicação fica
"aguardando avaliação" da Jane, relógio só em item com tempo esperado. O modal
**não** decide se a prova foi conquistada: envia o log a `/api/review` e mostra o
que a API devolver.

### Ficha

Resumo (nível, XP, ofensiva, domínio por matéria) e a **Árvore** em versão
simples: SVG com leque radial por matéria. Cada Ofício é um nó com: disco
(estado: Bloqueado, Disponível, Em prática, Liberado, Dominado), cinco
satélites (um por dimensão), marcador "precisa revisar". **O nó não tem nome
fixo** (D-041): o nome aparece numa etiqueta ao passar o mouse, focar ou
selecionar, no card de detalhe e na busca por nome; só o título da matéria fica
fixo. Arestas apagadas/abertas/acesas conforme desbloqueio. Pan, zoom (roda do
mouse, pinça, teclado), tela cheia, painel de detalhe com pré-requisitos,
provas, materiais e o que desbloqueia. Filtro por matéria. Conquistas e
Evolução ficam para depois.

Geometria: a referência é a Árvore do `prototipo/index.html` (ATL-57), que parte
do protótipo antigo: `R0 = 180`, `STEP = 140` por profundidade, leque de 170°
dividido entre matérias por número de Ofícios, `lane` desloca lateralmente
dentro do setor. Os raios crescem com a quantidade de Ofícios (`GAP_NOS = 118`).
Para aguentar volume, só se desenha o que está na tela (mais uma margem), em 4
níveis de detalhe pelo zoom, com as linhas juntas em poucos traçados (D-041).

## Fora do MVP nesta camada

Painel da Jane (chat), sessão em etapas com relógio, botão Fases, captura rápida,
missões, tela Livros, Evolução, Conquistas.

## Decisões de UX que continuam valendo

- Sidebar só com itens da aba; matérias são filtro, não navegação (D-016).
- 3 cliques até qualquer ação principal, a partir do Painel.
- PDF, quando entrar, abre em tela inteira (D-014).
- Árvore é o mapa de pré-requisitos; a linha do tempo é visão separada
  (Evolução, depois do MVP) (D-015).
- Escrita entra como 6ª prova para humanas, depois do MVP.

## Como usar estas referências ao construir `apps/web`

1. Para cada tela, abrir o protótipo novo aprovado e o `docs/01-arquitetura.md`
   lado a lado. Copiar a estrutura de componentes e os tokens, não o
   JavaScript.
2. Onde o protótipo simula (Gregor, importação), ligar ao real: rota
   `/api/session`, `/api/review`, importação.
3. Os dados de exemplo do protótipo antigo (`DATA` no JS) são um bom seed:
   três matérias, 20 Ofícios, questões com explicação. Converter para
   `imports/*.json` no formato de `docs/09-schema-importacao.md`.
