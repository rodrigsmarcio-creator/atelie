---
name: atelie-web
description: Regras para criar ou alterar telas, componentes e rotas de apps/web do Ateliê — sidebar dupla, regra dos 3 cliques, três paletas escuras trocáveis por tokens, estados de tela, Árvore em SVG, modal de prova, Painel, Planejar, Biblioteca, Praticar e Ficha. Use sempre que a tarefa tocar em apps/web, em UI, em layout, em componente React, em Tailwind, em route handler de /api, ou quando o pedido for "a tela de X", "o botão de Y", "o painel Z", mesmo sem a palavra frontend.
---

# Telas do Ateliê

O usuário declarou que a maior dificuldade dele é **começar a estudar**. Cada
tela é julgada por isso: quantos cliques até a primeira resposta registrada.

Referência: `docs/05-atelie.md` (abas, tokens, paletas) e o protótipo novo
aprovado no épico de identidade visual. Arquitetura e contratos:
`docs/01-arquitetura.md`. Nomes: `docs/07-glossario.md`. O ticket do Jira (chave
`ATL`) diz o escopo; siga `docs/11-esteira.md`.

## Antes de codar

1. Abra a tela correspondente no protótipo aprovado e copie a **estrutura**, não
   o JS. Sem protótipo aprovado, não comece a tela (a identidade visual vem
   antes do front).
2. Confira o épico da tela em `docs/08-roadmap.md`. Componente de fora do MVP
   não entra "já que estou aqui".
3. Se a tela precisa de dado que a API não entrega, defina a rota em
   `apps/web/app/api` primeiro, com Zod na entrada e tipo compartilhado de
   `packages/db`. A tela nunca importa `core` ou `db` direto.

## Navegação: sidebar dupla e 3 cliques

- **Rail** fixo com as cinco abas: Painel, Planejar, Biblioteca, Praticar,
  Ficha. Nunca muda. Configuração (paleta, Google Agenda) abre por um botão
  fixo.
- **Menu contextual** com os itens da aba ativa. Só itens da aba (D-016): nada
  de lista de matérias; matérias são filtro na Ficha e na Biblioteca. O menu
  **some** quando a aba tem um item só.
- Celular: rail vira barra inferior; o menu vira gaveta.
- **3 cliques**: qualquer ação principal a no máximo 3 cliques a partir do
  Painel. Painel → Começar → responder = 2. Painel → Ofício → material = 2. Se
  um fluxo passar de 3, é bug: adicione o atalho, não justifique.
- Ao terminar uma tela, liste os fluxos principais dela com a contagem de
  cliques.

## Visual: três paletas escuras trocáveis

- Tailwind só. Cores só por **tokens semânticos** (`bg`, `surface`, `surface-2`,
  `line`, `text`, `muted`, `accent`, `on-accent`, `hot`, `hot-2`, `xp`, `halo`,
  `glow`, `ok`, `bad`), trocados por `data-theme` no `<html>`. Valores em
  `docs/05-atelie.md`. Sem cor hexadecimal solta em componente.
- Só modo escuro. Paletas: E (`tokyo`), G (`borgonha`, a padrão) e H (`verde`).
  A escolha vem de `settings.tema` e vale em todos os aparelhos.
- Fonte e ornamento são **atrelados à paleta** (token/variável, nunca fixo no
  componente).
- Tokens decorativos (`hot`, `halo`, `glow`) **nunca** são cor de texto.
- Cor de matéria (`subject.color`) só identifica a matéria: ponto, tag, leque.
  Estado (risco, sucesso, bloqueado) usa `bad`, `ok`, `muted`, nunca a cor da
  matéria.
- Componentes base com um arquivo cada em `apps/web/components/ui`: `Card`,
  `Button` (primary/ghost/quiet), `Chip`, `Eyebrow`, `Bar`, `Tag`, `IconBtn`,
  `StatCard`, `ProgressRing`, `Toast`, mais os de gamificação (anel de ofensiva,
  barra de XP, coroa do nível). Reaproveite; não crie variante nova sem avisar.
- Ícones: sprite SVG em um único componente `Icon`.
- Uso principal no PC, mas mobile-first: gutter mínimo de 16px. Nada rola na
  horizontal, exceto a grade semanal e a Árvore, cada uma no próprio contêiner.

## Estados obrigatórios

Toda tela com dados tem **carregando, vazio, erro e sucesso**. O vazio diz o
que fazer a seguir, com um botão. O erro diz o que deu errado e como
resolver. Sem skeleton genérico em tela que carrega em menos de 300 ms; use
`aria-busy`.

## Acessibilidade mínima (WCAG 2.2 AA)

HTML semântico; contraste 4,5:1 em **cada uma das três paletas** (há teste
automático; não escureça `muted` nem clareie um token de texto sem rodá-lo);
alvos de toque ≥ 24px, ideal 44px; foco visível em tudo; tudo operável por
teclado; `aria-label` em botão só com ícone; `role="dialog"` + foco preso em
modal; `prefers-reduced-motion` desliga `halo`, `glow` e animações.

## Telas e componentes com regra própria

**Painel (`app/(secoes)/painel`).** Mostra a sessão do dia (4 blocos, com minutos
e motivo; bloco vazio aparece pulado com o motivo), modo Completa/Curta, ofensiva,
nível e XP, revisões vencidas, mini evolução. Um botão **Começar** executa o
bloco 1 (A-003). Sem missões, sem agenda do dia, sem captura rápida.

**Praticar.** Fila de hoje (Ofícios com as 5 dimensões em barras, botão
Resolver) e Cartões (Errei, Difícil, Bom, Fácil).

**Modal de prova (`components/prova`).** Implementa as regras de
`docs/02-ciencia.md` C-05, C-06, C-07, C-10: ver solução invalida; resposta
rápida sem raciocínio pede texto; Explicação exige texto; cronômetro de
`TIMED_PROOF_SECONDS` nas provas de fluência. O modal **não** decide se a prova
foi conquistada: envia o log a `/api/review` e mostra o que a API devolver
(`proofEarned`, `unlocked`, `dominated`, `xpGained`).

**Biblioteca.** Materiais e Importar (`.json` pelo validador; `.md` guardado até a
Jane converter). Mostre as instruções do fluxo. A tela Livros não existe no MVP.

**Ficha.** Resumo (nível, XP, ofensiva, domínio por matéria) e a **Árvore**
(`components/arvore`): SVG com leque radial por matéria, geometria `R0 180`,
`STEP 140`, leque de 170°, `lane`. Cinco satélites por Ofício (um por
dimensão), estados Bloqueado/Disponível/Em prática/Liberado/Dominado e o
marcador "Precisa revisar". Pan, zoom, teclado, painel de detalhe. Dados vêm de
`/api/skills` já com `mastery`, `confidence`, `status`, `needsReview` calculados
no servidor; o componente não calcula domínio.

**Planejar.** Grade da semana com os eventos do Google Agenda e a ação
"Planejar sessão": o usuário escolhe dia e hora, o app cria **um** evento com os
4 blocos. O acesso ao Google fica só no servidor.

**Jane (chat).** Fora do MVP. Não simule respostas.

## Rotas (`app/api`)

- Validação Zod na entrada; erro em formato único `{ error: { code, message } }`.
- `POST /api/review` é a única porta de evidência; `POST /api/import` a única
  de conteúdo. Nenhuma outra rota escreve em `review_logs`, `skills` ou `items`.
- Paginação em toda coleção que cresce.
- Sem autenticação na v1 (D-017), mas sem CORS aberto: só mesma origem.
- Segredo do Google nunca vai para o cliente nem para o Git.

## Antes de encerrar

Liste: telas e componentes tocados, rotas criadas, fluxos com contagem de
cliques, quais dos quatro estados cada tela implementa, e confirme que a tela
funciona nas três paletas.
