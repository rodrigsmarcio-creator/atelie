# 06 · Registro de decisões

Uma linha por decisão: o quê, por quê, o que foi descartado. Decisão nova entra
no mesmo commit que a implementa. Decisão revertida não é apagada: ganha
"Revertida por D-xxx".

As decisões D-001 a D-019 mantêm o texto original, com os nomes antigos:
**Curador = Gregor**, **Mestre = Jane**, **Hoje = Painel** (D-020).

| ID | Data | Decisão | Motivo | Descartado |
|---|---|---|---|---|
| D-001 | 2026-11-15 | Recomeçar o Ateliê do zero, reaproveitando nomes, conceito, skills e a Árvore do Trilha | O rascunho antigo nunca saiu do papel; o que valia foi mantido | Continuar o rascunho |
| D-002 | 2026-11-15 | Construir uma fatia vertical antes do motor completo (Hoje → Sessão → Prova → registro) | "Motor primeiro" é o que travou a versão anterior; precisa de algo usável para calibrar | Curador completo (FSRS, semana) antes da primeira tela |
| D-003 | 2026-11-15 | Claude gera conteúdo; o Curador decide agenda por regras. IA nunca decide o plano | Determinismo, custo, depuração, reprodutibilidade | Planejamento por LLM |
| D-004 | 2026-11-15 | Mestre fora do app na v1: Claude Code + skill `atelie-conteudo` gera JSON, o app importa | Plano Pro não é API; chat embutido exige chave e custo por uso | Chat embutido desde o início |
| D-005 | 2026-11-15 | SQLite (better-sqlite3) + Drizzle | Um usuário, um arquivo, backup trivial; skills já assumem Drizzle | Postgres |
| D-006 | 2026-11-16 | Gamificação da v1 = streak e Árvore. Nível, XP, missões ficam para a fase 4 ou nunca | Conceito: pontos não substituem domínio; streak é o que o usuário diz ajudar a começar | Nível/XP/missões na v1 — **Revertida em parte por D-021** (XP e nível entram no MVP; missões e conquistas seguem fora) |
| D-007 | 2026-11-16 | Monorepo pnpm com `packages/core`, `packages/db`, `apps/web` (Next.js) | `core` isolado e testável; um processo só no PC de casa | Vite + Hono separados; app único com pastas |
| D-008 | 2026-11-16 | FSRS via `ts-fsrs` atrás de adaptador; v0 com intervalos fixos até haver histórico | Algoritmo publicado; calibração exige logs reais | SM-2 à mão; FSRS desde o dia 1 — **Revertida em parte por D-023** (FSRS desde o MVP; o adaptador continua) |
| D-009 | 2026-11-16 | Tabela `availability` só na fase 5 | Não criar schema para feature que não existe | Criar agora "para não precisar de migration" — **Substituída por D-021** (Planejar lê o Google Agenda; `availability` não será criada) |
| D-010 | 2026-11-16 | `review_logs` append-only; `memory_states` e `proofs` são caches reconstruíveis | Permite trocar algoritmo e recalibrar pesos com dados reais | Guardar só o estado atual |
| D-011 | 2026-11-16 | Domínio = provas (máx. 3) com índice de confiança; desbloqueio exige 2 provas e confiança mínima | Defesa contra início a frio e ilusão de competência (C-14, C-15) | Domínio = média de acertos — **Revertida por D-022** |
| D-012 | 2026-11-16 | Cinco tipos de prova por Ofício (sem consultar, variante, outro dia, cronometrado, expliquei); escrita como 6º para humanas | Herdado do Trilha; cada um aponta para uma linha de `02-ciencia.md` | Aba de redação separada — **Revertida em parte por D-022** (as 5 provas viram as 5 dimensões; escrita segue como 6ª depois do MVP) |
| D-013 | 2026-11-16 | Progresso de leitura não altera domínio | C-01 | Contar leitura como aprendizado |
| D-014 | 2026-11-16 | PDF abre em tela inteira com Mestre recolhível | Pedido do usuário; meio a meio não cabe no celular | Leitura meio a meio |
| D-015 | 2026-11-16 | Árvore = mapa de pré-requisitos (estética de RPG); linha do tempo é visão separada em Evolução | São duas perguntas diferentes ("o que depende de quê" e "o que aprendi quando") | Uma visão só |
| D-016 | 2026-11-16 | Sidebar contém só itens da seção; matérias ficam como filtro na Árvore e no Acervo | Pedido do usuário; evitava duplicar navegação | Lista de matérias na sidebar |
| D-017 | 2026-11-16 | Sem autenticação na v1; rede local; fora de casa só via Tailscale | Um usuário; port-forward é risco sem ganho | Login; HTTPS local |
| D-018 | 2026-11-16 | Toda sugestão do Curador grava `reason` e `breakdown`; planos antigos nunca são apagados | Única forma de calibrar pesos sem adivinhar | Guardar só o plano atual |
| D-019 | 2026-11-16 | Pesos `W_*` e limiares são hipótese até haver meses de `review_logs`; revisão manual, não automática, na v1 | Honestidade sobre a base; ver `02-ciencia.md` | Ajuste automático desde o início |
| D-020 | 2026-11-18 | Renomear: Curador → **Gregor**, Mestre → **Jane**, aba Hoje → **Painel**, streak → **Ofensiva**; a aba da Árvore passa a se chamar **Ficha** (resumo + Árvore). Skill `atelie-motor` vira `atelie-gregor`; `docs/03-motor.md` vira `docs/03-gregor.md` | O Márcio não gostava de "Curador"; nomes próprios pedidos por ele | Manter os nomes antigos |
| D-021 | 2026-11-18 | O MVP inclui: ofensiva (qualquer tentativa conta), XP e nível, aba Ficha, e Planejar com Google Agenda (API gratuita, ler eventos e criar o evento da sessão). Conexão feita em configuração, não é login do app. Missões e conquistas seguem fora | O Márcio quer essas peças já no primeiro ciclo; Planejar sai da fase 5 | Streak só com prova válida; calendário na fase 5 |
| D-022 | 2026-11-19 | Domínio por **5 dimensões** (Compreensão conceitual, Fluência procedimental, Resolução de problemas, Autonomia, Explicação) no lugar dos 5 tipos de prova antigos; "Outro dia" sai (papel do FSRS). Confiança = dimensões ÷ 5, com penalidade de erro recente. **Liberado** = 2 dimensões diferentes (abre os dependentes); **Dominado** = 5. Mesmo Dominado, o Ofício continua com revisão ("Precisa revisar") sem perder prova | Pedido do Márcio, inspirado em Bloom; resolve a fórmula antiga em que a confiança exigia ~5 tentativas | Domínio por número de provas (máx. 3); "Outro dia" como prova |
| D-023 | 2026-11-19 | FSRS (`ts-fsrs`, atrás do adaptador) agenda todos os itens desde o MVP; sem intervalos fixos. A revisão do Ofício vem da recuperabilidade média dos itens dele. Meta de retenção 0,9 | O Márcio quer revisão espaçada pela curva do esquecimento; FSRS já é um modelo moderno dela e dispensa implementação à parte | Intervalos fixos no MVP |
| D-024 | 2026-11-19 | O Gregor monta a **sessão do dia em 4 blocos fixos** (revisão pré-matéria 10–15 min, matéria nova 40–50, reforço 20–30, cartões 15–20), modos Completa e Curta (metade), bloco vazio é pulado com motivo, e a sessão vira **um** evento no Google Agenda. No MVP não há fórmula de prioridade com pesos | Rotina ideal definida pelo Márcio; ordenação simples e explicável | Plano por minutos livres (15/30/60/livre); fórmula ponderada `W_*` |
| D-025 | 2026-11-19 | O app tem **três paletas escuras trocáveis** (E Tokyo e âmbar, G Borgonha e ouro, H Verde e ouro), por tokens semânticos. Escolha guardada no banco (`settings`), igual em todos os aparelhos. Padrão: G. Fonte atrelada à paleta. Ornamento próprio por paleta. Teste de contraste das três no CI | Pedido do Márcio; identidade visual nova | Tema único; paletas A, B, C, D e F |
| D-026 | 2026-11-18 | Esteira rígida: Jira `ATL` (Épico → História → Subtarefa), uma branch por subtarefa, PR com CI e SonarCloud, testes em Docker só no PR, repositório **privado**. Detalhes em `docs/11-esteira.md` | Processo definido pelo Márcio com base no projeto Zappi | Repositório público; trabalhar sem ticket |
| D-027 | 2026-11-19 | Ofensiva sem proteção de dia perdido no MVP (perdeu, volta a zero, guarda o recorde). Tentativa **errada** não dá XP e baixa a confiança do Ofício, que entra na fila de reforço, sem tirar o domínio já conquistado | Simples de explicar; proteção fica para depois | Congelar ofensiva; erro apagar prova |
| D-028 | 2026-11-18 | Fluxo de conteúdo: link/PDF → API de extração → markdown → Jane → JSON → validador → banco → Gregor. A API de extração fica **fora do MVP**; no MVP a Biblioteca importa `.json` (validador) e guarda `.md` até a Jane converter. A tela Livros fica para depois | Extração de PDF é risco técnico (fórmulas, tabelas, escaneado); o resto do ciclo já funciona sem ela | Extração dentro do MVP |
| D-029 | 2026-11-19 | A exceção da esteira é o **primeiro commit** (ATL-59), direto na `main` e sem PR, e não "o primeiro PR". Repositório privado `atelie`; `.gitignore` também exclui `*.pdf`, `*.db`, `*.sqlite*` e `.claude/settings.local.json` | O repositório ainda não existe, então não há base nem CI para um PR; banco, PDFs e config local não vão para o Git | Abrir um PR do primeiro commit; deixar o texto do doc como estava |

## Decisões em aberto

| ID | Pergunta | Precisa de | Prazo |
|---|---|---|---|
| A-001 | Leque de 360° quando há duas ou mais matérias na Árvore? | Testar no protótipo | Épico da Ficha |
| A-002 | Limite do cronômetro por matéria (60 s não serve para Filosofia) | Uso real | Depois do MVP |
| A-003 | Painel com um botão só ou três cartões? Parcialmente resolvida: o botão Começar executa a sessão do dia | Testar no protótipo | Épico de identidade visual |
| A-004 | ~~Fluxo de matéria nova no app (importar) ou só via Claude Code?~~ **Resolvida por D-028** | — | — |
| A-005 | Next.js pesa no PC de casa? Se sim, Vite + Hono | Medir no primeiro ciclo | Depois do primeiro ciclo |
| A-006 | Como se conquista a prova **Compreensão conceitual**? Proposta: acerto em item marcado como conceitual pela Jane (campo novo em `items`) | Ticket do Gregor e do schema | Épico do Gregor |
| A-007 | O Google "modo teste" derruba o acesso a cada 7 dias (pelo que sei)? Como o servidor guarda e renova o acesso, sem segredo no Git? | Ticket de teste do Google Agenda | Épico do Planejar |
| A-008 | Valores iniciais de XP, curva de nível, penalidade de erro e faixas de duração dos blocos (hipótese) | Ajuste no uso | Épico do Gregor |
| A-009 | Fonte da paleta G (Libre Baskerville) serve só para títulos ou também para o texto? E os ornamentos de E e G (a H tem a coroa) | Protótipo | Épico de identidade visual |
| A-010 | O "relógio por bloco" (sessão em etapas guiada) entra depois do MVP? Quando? | Uso real | Depois do MVP |
