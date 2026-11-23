# 08 · Roadmap

O trabalho é organizado em **épicos no Jira** (chave `ATL`), em fluxo contínuo,
sem sprints. Este documento é o mapa do MVP e a ordem sugerida; o Jira tem o
detalhe (histórias, critérios de aceite, subtarefas). Cada ticket traz o modelo
sugerido (ver `CLAUDE.md`). Processo rígido em `docs/11-esteira.md`.

Regra: depois do MVP, nenhuma fase nova começa sem o MVP em **uso real** por
pelo menos duas semanas.

## Ordem dos épicos do MVP

A ordem é uma sugestão; o plano final dos épicos e histórias é aprovado pelo
Márcio **antes** de criar qualquer ticket.

O MVP tem **9 épicos** (ATL-4 a ATL-12). O **detalhe vive no Jira**: histórias,
critérios de aceite, "pronto quando", docs a ler e subtarefas. O deploy gratuito
com login faz parte do MVP (D-035).

| Ordem | Épico | Jira | O que entrega | Modelo | Espera por |
|---|---|---|---|---|---|
| 1 | Esteira | ATL-5 | Repositório, monorepo, CI, testes em Docker, SonarCloud e o fluxo Jira ↔ Git | Sonnet (Opus na estrutura) | — |
| 2 | Regras de Negócio | ATL-4 | Docs e decisão do deploy (ATL-13), regras do Gregor fechadas (ATL-14), kit visual das 3 paletas (ATL-15), protótipo aprovado (ATL-16) e revisão final (ATL-17) | Opus nas regras, Sonnet no visual, Haiku na revisão | O repositório existir (ATL-18) |
| 3 | Infra e Deploy | ATL-6 | Hospedagem gratuita e login, banco, importação de JSON, seed, base do app web, rotas da API, deploy automático e backup | Opus no banco, no login e na hospedagem; Sonnet no resto | ATL-13 (decisão do deploy); base do app depois do kit visual (ATL-15) |
| 4 | Gregor | ATL-7 | O motor em `packages/core`: domínio por 5 dimensões, desbloqueio, FSRS, sessão do dia em 4 blocos, ofensiva e XP | Opus | ATL-14 (A-006 e A-008) |
| 5 | Painel | ATL-8 | Sessão do dia com botão Começar, ofensiva, nível e XP, revisões vencidas, mini evolução | Sonnet | Protótipo (ATL-16), base do app (ATL-26) e rotas (ATL-27) |
| 6 | Praticar | ATL-9 | Fila de hoje, modal de prova e cartões; fecha o primeiro ciclo completo com o Painel | Sonnet (Opus em `/api/review`) | ATL-16, ATL-26 e ATL-27 |
| 7 | Biblioteca | ATL-10 | Tela Importar (`.json` pelo validador, `.md` guardado) e Materiais | Sonnet | Rota `/api/import` (ATL-27) |
| 8 | Ficha | ATL-11 | Resumo (nível, XP, ofensiva, domínio por matéria) e Árvore de Ofícios simples | Sonnet (Opus nos estados) | Primeiro ciclo (Painel + Praticar) |
| 9 | Planejar | ATL-12 | Google Agenda: conectar, ver a semana e criar um evento por sessão do dia | Sonnet (Opus se o OAuth travar) | Deploy automático (ATL-29) |

Riscos que seguem valendo:

- Ficar "ajustando o schema" por semanas. Fecha o schema v1 e depois é
  migration.
- Dois épicos (Painel e Praticar) formam o primeiro ciclo completo: abrir o
  app, clicar Começar, fazer uma prova, ver a prova acender, o XP subir, a
  ofensiva contar e a próxima revisão agendada. Usar por duas semanas.

## Depois do MVP

Em ordem:

1. **ATL-119, Matéria ampla: curso, pré-requisitos e conteúdo em tandas.** Não é
   fase nova: prepara o conteúdo do MVP. O texto de estudo da fase Aprender
   (D-052) faz parte do MVP e fica pronto antes de começar as 2 semanas de uso.
2. **Marco: MVP em uso real por 2 semanas** (a regra do topo deste documento).
3. **ATL-120, Mini curso superior:** nivelamento (A-012), Árvore cheia com zoom
   por níveis e busca (D-047), trabalhos e TCC corrigidos pela Jane e nota por
   disciplina (D-048).

### Candidatos

- Extração de PDF e de link (API de extração), leitor de PDF, vídeo como
  material, tela Livros.
- Sessão em etapas com relógio por bloco, captura rápida.
- Evolução (linha do tempo), Conquistas, caderno de erros, simulados.
- Prazo de prova e plano da semana no Gregor; proteção de ofensiva; benefícios
  por nível.
- Chat embutido da Jane e correção de redação.
- Recalibração de parâmetros a partir de `review_logs`.
- Serviço do Windows.

## O que mede sucesso

Não é feature entregue. É:

1. Dias com ao menos uma tentativa nas últimas 4 semanas (meta: 5 de 7).
2. Tempo entre abrir o app e a primeira resposta registrada (meta: < 60 s).
3. Ofícios dominados por mês.
4. Quantas vezes a sessão sugerida pelo Gregor foi ignorada (se for muitas, as
   regras estão erradas, não o usuário).
