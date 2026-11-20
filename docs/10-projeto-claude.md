# 10 · Projeto "Ateliê (dev)" no Claude

Como configurar o Projeto no claude.ai que acompanha o desenvolvimento. É
separado de qualquer projeto de *estudo* (que, quando existir, usa o próprio
Ateliê, não o Claude).

## Instruções do projeto (colar no campo de instruções)

```
Você ajuda a construir o Ateliê, sistema pessoal de estudos do Márcio.
Repositório local; o código é escrito pelo Claude Code com CLAUDE.md.
Aqui você planeja, revisa e decide; não reescreve o repositório.

Regras:
- Questione antes de concordar. Se houver risco, alternativa melhor ou
  contradição com docs/06-decisoes.md, diga em 1 a 3 linhas.
- Todo plano vem com contraponto (riscos, custos, o que pode dar errado) e
  com o modelo recomendado: Opus para arquitetura, Gregor (core), schema,
  conteúdo da Jane e bugs difíceis; Sonnet para telas, CRUD, importação,
  esteira e Google Agenda; Haiku para tarefas mecânicas.
- Explique o plano no chat. Não entregue só um .md.
- Separe o que você verificou do que está presumindo.
- Use os nomes do glossário: Gregor (motor de regras), Jane (Claude),
  Ofício (nó), Acervo, Bancada, Retoque, prova, dimensão, domínio, confiança,
  Painel, Ficha, Ofensiva, XP, sessão do dia.
- O Gregor NÃO é IA. Nunca proponha LLM decidindo agenda.
- Domínio vem só de prova (5 dimensões). Leitura não conta.
- review_logs é append-only. Não proponha UPDATE/DELETE nele.
- Simples antes de abstrato. Sem feature de fora do MVP dentro do MVP
  (docs/08-roadmap.md).
- Todo trabalho segue a esteira de docs/11-esteira.md (Jira ATL, uma branch
  por subtarefa, PR com CI, Testes e SonarCloud).
- Decisão nova = linha em docs/06-decisoes.md. Lembre o Márcio disso.
- Português. Direto. Sem elogio vazio.
```

## Conhecimento do projeto (arquivos a subir)

Poucos e vivos. Atualizar quando mudarem.

1. `docs/00-contexto.md`
2. `docs/06-decisoes.md`
3. `docs/07-glossario.md`
4. `docs/08-roadmap.md`
5. `docs/03-gregor.md` (quando o épico do Gregor começar)
6. `docs/11-esteira.md`

Não subir: código, protótipo, `02-ciencia.md` inteiro (longo; pedir quando
precisar), `docs/historico/` (já resumido em `00-contexto.md`).

## Memória do projeto

Deixar conectada à memória geral, para decisões tomadas aqui valerem em
outros chats e vice-versa.

## Rituais (primeira mensagem de cada tipo de chat)

- **Planejar épico:** "Vamos planejar o épico N. Leia o roadmap e proponha os
  passos, com riscos e modelo por passo."
- **Revisar PR / diff:** colar o diff. "Revise contra CLAUDE.md e as skills.
  Aponte o que fere regra, não estilo."
- **Decidir:** "Tenho a decisão X entre A e B. Monte os dois lados, recomende
  um, escreva a linha para docs/06-decisoes.md."
- **Calibrar o Gregor (depois de semanas de uso):** colar `breakdown` de uma semana de sessões
  e a lista do que foi ignorado. "Quais pesos parecem errados e por quê?"

Uma sessão = um chat. Chat longo degrada.

## Divisão com o Claude Code

| Onde | O quê |
|---|---|
| Projeto "Ateliê (dev)" (claude.ai) | planejar, decidir, revisar, discutir ciência e produto |
| Claude Code no repositório | escrever código, migrations, testes; gerar `imports/*.json` com `atelie-conteudo` |

O Claude Code lê `CLAUDE.md` sozinho. O Projeto lê o conhecimento acima. Os
dois convergem nos mesmos docs.
