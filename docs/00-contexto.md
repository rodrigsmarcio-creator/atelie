# 00 · Contexto

Este documento é o contexto que o Claude Code precisa para entender o projeto
antes de qualquer tarefa. Resume o conceito, fixa o escopo do MVP e diz o que
não é o Ateliê.

## O problema

Estudar por conta própria tem um custo administrativo alto: decidir o que
estudar, organizar matérias, distribuir a semana, achar material, montar
exercícios, revisar, acompanhar progresso. Isso consome tempo e energia que
deveriam ir para aprender. E costuma exigir cinco ou seis ferramentas ao mesmo
tempo (Notion, Anki, NotebookLM, Keep, Agenda), que o estudante precisa manter
sincronizadas na mão.

A maior dificuldade declarada do Márcio é **começar**. O produto existe para
remover a fricção entre "quero estudar" e "estou estudando".

## O que o Ateliê é

Um único ambiente, de uso pessoal, que:

1. **Decide por você o que estudar agora** e monta a sessão do dia (Gregor).
2. **Guarda e liga os materiais aos assuntos** (Biblioteca, que é o Acervo).
3. **Faz você praticar e prova que aprendeu** (Praticar: provas, cartões).
4. **Mostra a evolução de forma visível** (Ficha: nível, XP, ofensiva e Árvore
   de Ofícios).
5. **Põe os estudos na sua agenda** (Planejar, com Google Agenda).
6. **Tem o Claude como parte do ambiente**, com o contexto dos seus estudos
   (Jane).

O documento de conceito original está em `docs/historico/conceito-original.md`.
É a visão de longo prazo, escrita com os nomes antigos (Curador, Mestre, Hoje).
Este arquivo é o recorte do que será construído.

## O que o Ateliê não é

- Não é uma IA que estuda por você. Sua finalidade é tornar o ato de estudar
  mais simples e consistente.
- Não é um chatbot com abas em volta. O Claude entra como peça do fluxo, com
  contratos definidos, não como janela genérica.
- Não é um jogo. A gamificação (ofensiva, XP, nível, Ficha) representa
  progresso real. Pontos nunca substituem domínio, e domínio só vem de prova.
- Não é um produto para terceiros. Um usuário (com login só dele, D-035), sem
  multi-tenant. Isso simplifica tudo e deve ser aproveitado.

## Os dois casos de uso centrais

Tudo o que for construído deve servir a um destes dois cenários. Se não serve,
é fase futura.

**A. Começar uma matéria do zero.** O usuário diz "quero estudar Redes de
Computadores". A Jane decompõe em Ofícios com pré-requisitos e gera itens de
prática (JSON). O arquivo é importado (pelo comando ou pela tela Importar da
Biblioteca, D-051), a Ficha ganha um leque novo na Árvore e o Gregor passa a
sugerir pelo primeiro Ofício disponível. Matéria ampla é quebrada em disciplinas
de uma grade de curso superior (D-045).

**B. Estudar a partir de um material.** O fluxo completo é: link ou PDF → API de
extração → markdown → Jane → JSON → validador → banco → Gregor. A extração de
PDF e de link fica **fora do MVP**. No MVP o usuário traz o material já em
markdown (a Biblioteca guarda o `.md` até a Jane transformá-lo em JSON) ou traz
o JSON pronto (que passa direto pelo validador). Capítulos de livro de leitura
(A República) viram Ofícios; livros de estudo (Stewart) ficam ligados aos
Ofícios da matéria.

## As três peças

### Gregor — o motor

Função pura, determinística, em `packages/core`. Entrada: o estado (Ofícios
com provas, itens com revisão agendada, tentativas, matérias, "agora" e fuso).
Saída: a sessão do dia em quatro blocos, o domínio de cada Ofício, a ofensiva e
o XP, com motivo em cada decisão.

Não usa IA. Não usa rede. Mesma entrada, mesma saída. Especificação em
`docs/03-gregor.md`.

### Jane — o Claude

Faz o que exige interpretação: decompor matéria, gerar questões e cartões,
explicar, dar pista em prova, corrigir escrita, resumir capítulo.

Na v1 opera **fora do app**: você usa o Claude Code com a skill
`atelie-conteudo`, ela gera JSON, você importa. A Jane não decide o que
estudar e nunca grava direto no banco: tudo passa pelo validador. O que ela
gera nasce com `reviewed_by_user: false` e `origin: "ia"`. Chat embutido depende
de chave de API e custo por uso; fica para depois do MVP, só se a fricção do
import incomodar.

### App — estado e telas

`packages/db` guarda tudo em SQLite. `apps/web` tem cinco abas: Painel,
Planejar, Biblioteca, Praticar e Ficha. Fluxo e visual em `docs/05-atelie.md`.

## Direção de longo prazo

O Ateliê caminha para ser um **mini curso superior**: a Jane quebra uma matéria
ampla em disciplinas de uma grade de curso superior consolidado, registrando
curso, instituição e ano (D-045). Pré-requisito vale por padrão, inclusive entre
matérias (D-044), e a Árvore fica cheia a cada rodada (D-047). O nível "curso"
já existe no backend, sem tela no MVP (D-046). Trabalhos, TCC, notas por
disciplina e nivelamento (A-012) vêm no épico ATL-120, só depois de 2 semanas de
uso real do MVP (D-048).

## Escopo do MVP

Ver `docs/08-roadmap.md` para os épicos. Em uma frase: **abrir o Ateliê, ver a
sessão do dia, praticar, registrar, ver a ofensiva, o XP e a próxima revisão,
e marcar o estudo na agenda.**

Dentro do MVP:

- **Painel** (visual novo, funcionamento mínimo): sessão do dia do Gregor com
  botão Começar, ofensiva, nível e XP, revisões vencidas, mini evolução.
- **Planejar**: grade da semana com Google Agenda; o usuário escolhe a sessão e
  o horário e o app cria o evento.
- **Biblioteca**: Materiais e Importar (`.json` direto pelo validador; `.md`
  guardado até a Jane converter). Materiais lista os PDFs locais e os links,
  citados por nome de arquivo ou link e ligados aos Ofícios com páginas; o
  Márcio abre o arquivo fora do app (D-049, D-050).
- **Fluxo de conteúdo**: o Márcio dá as fontes ao Claude Code, a Jane importa
  pelo comando no banco real (D-051); a tela Importar é a alternativa.
- **Fase Aprender** (D-052): para o Ofício sem nenhuma tentativa, texto de
  estudo (explicação, recomendações, orientações e dúvidas comuns) e sessão com
  a Jane para dúvidas específicas. Não dá XP, não conta para a ofensiva e não
  sobe domínio.
- **Praticar**: fila de hoje (as 5 provas, botão Resolver) e Cartões.
- **Ficha**: resumo (nível, XP, ofensiva, domínio por matéria) e Árvore
  simples.
- **Gregor mínimo**: domínio por 5 dimensões, desbloqueio, revisão espaçada
  com FSRS, sessão do dia, ofensiva e XP.
- **Três paletas escuras trocáveis**, escolhidas em configuração.

Fora do MVP: tela Livros, extração de PDF e de link, sessão em etapas com
relógio por bloco, captura rápida, missões, conquistas, Evolução, caderno de
erros, simulados, plano da semana automático, prazo de prova no cálculo, chat
embutido da Jane, leitor de PDF, vídeo, trabalhos, TCC, notas por disciplina,
nivelamento, tela do nível curso, proteção de ofensiva, redação corrigida,
benefícios por nível.

## Princípios que decidem empates

1. **Começar é a métrica.** Se duas opções empatam, vence a que reduz cliques
   até a sessão.
2. **Domínio vem de prova.** Ler, assistir ou "marcar como feito" não sobe
   domínio.
3. **Explicável.** Toda sugestão do Gregor diz por quê. Toda nota de domínio
   diz de quais provas veio.
4. **Reprodutível.** Com o log bruto (`review_logs`) dá para reconstruir
   qualquer estado e recalibrar qualquer regra.
5. **Simples antes.** Regra de 10 linhas que funciona vence modelo de 1.000 que
   ninguém depura.

## Quem usa e onde roda

Um usuário. Uso diário no PC (`pnpm dev`) e acesso pelo navegador do celular na
mesma rede. Deploy gratuito no MVP (D-035), com login obrigatório; hospedagem e banco em A-011. O
repositório é público (D-034); banco, PDFs, segredos e conteúdo real ficam fora do Git.
