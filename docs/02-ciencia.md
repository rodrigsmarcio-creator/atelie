# 02 · Base científica das regras

Toda regra de decisão do Gregor aponta para uma linha deste documento. Se
uma regra não tem linha aqui, ela é **hipótese** e vai marcada assim em
`params.ts`. O objetivo não é citar por citar: é saber, quando o sistema
sugerir algo estranho, se a culpa é de um peso chutado ou de um princípio que
a literatura sustenta.

Níveis de confiança usados abaixo:

- **Forte**: meta-análise ou replicação ampla.
- **Moderada**: vários estudos convergentes, efeito depende do contexto.
- **Hipótese**: parece razoável, sem base empírica que eu tenha verificado.

As referências foram escritas de memória e conferidas apenas pelo nome e ano.
Antes de citar em qualquer lugar fora deste repositório, confirme na fonte.
Duas referências que a skill `atelie-gregor` menciona ("Rowland 2014" e
"Fiechter 2018") estão aqui com a ressalva correspondente.

---

## C-01 · Recuperar da memória vale mais do que reler

**Regra:** domínio só sobe com prova (recuperação ativa). Ler material, assistir
vídeo ou "marcar como lido" não altera domínio.

**Evidência (forte):** o efeito de teste. Roediger & Karpicke (2006) mostram
retenção maior após testar do que após reler, com o mesmo tempo de estudo.
Rowland (2014), meta-análise em *Psychological Bulletin*, confirma o efeito em
larga escala. Dunlosky et al. (2013) classificam prática de recuperação como
técnica de "alta utilidade".

**No código:** `mastery/` ignora materiais; só `review_logs` entra no cálculo.

## C-02 · Espaçar as revisões

**Regra:** retoques são agendados com intervalo crescente, nunca em bloco no
mesmo dia.

**Evidência (forte):** efeito de espaçamento. Cepeda et al. (2006),
meta-análise de centenas de experimentos: prática distribuída supera prática
concentrada em retenção de longo prazo. Dunlosky et al. (2013): "alta
utilidade".

**No código:** o espaçamento vem do FSRS desde o MVP (C-03, D-023). Não há mais
intervalos fixos.

## C-03 · O intervalo ótimo depende do histórico do item

**Regra:** desde o MVP (D-023), o próximo retoque de cada item vem do FSRS, que
estima estabilidade e recuperabilidade a partir dos acertos e erros anteriores.
A curva do esquecimento de Ebbinghaus (C-17) é a origem da ideia; o FSRS é um
modelo moderno dela, então não se implementa uma curva à parte.

**Evidência (moderada):** FSRS (Free Spaced Repetition Scheduler) é derivado do
trabalho de Ye et al. (2022), *A Stochastic Shortest Path Algorithm for
Optimizing Spaced Repetition Schedules*, KDD. É o escalonador padrão do Anki
desde 2023 e mostra erro de previsão menor que SM-2 nos benchmarks públicos do
projeto open-spaced-repetition. A evidência é de engenharia (benchmarks),
não de ensaio controlado.

**No código:** `memory/fsrs-adapter.ts`. Nunca armazenar recuperabilidade;
calcular do tempo decorrido. `memory_states` é cache de `review_logs`.

## C-04 · Feedback depois da prova é obrigatório

**Regra:** toda questão tem `explanation`. O validador recusa item sem ela. A
explicação aparece depois da resposta, certa ou errada.

**Evidência (forte):** Butler & Roediger (2008) e Butler, Karpicke & Roediger
(2008): feedback após o teste aumenta o benefício da recuperação e corrige o
aprendizado de alternativas erradas em múltipla escolha, que sem feedback podem
ser retidas como verdadeiras. A skill cita também "Fiechter 2018"; não
localizei a referência exata e a trato como **a confirmar**.

**No código:** `FEEDBACK_REQUIRED = true` em `params.ts`; Zod exige
`explanation` não vazia em `docs/09-schema-importacao.md`.

## C-05 · Ver a solução antes de tentar não conta

**Regra:** a prova Autonomia só acende se o usuário respondeu antes de
abrir a solução. Abrir a solução invalida a tentativa para fins de domínio
(mas o log é gravado, com a marca `viewed_solution`).

**Evidência (moderada):** decorre de C-01. Estudar o exemplo resolvido tem
valor para iniciantes (efeito do exemplo trabalhado, Sweller), mas não é
recuperação e não deve ser contado como tal.

**No código:** `review_logs.viewed_solution`; `mastery/` descarta tentativas
com `viewed_solution = true`.

## C-06 · Responder rápido demais pede explicação

**Regra:** acerto em menos de `FAST_ANSWER_MS` sem raciocínio escrito não
conta até o usuário escrever uma ou duas frases.

**Evidência (hipótese):** proteção contra chute e contra reconhecimento
superficial. Não há estudo que eu conheça com esse limiar. O valor de 3.000 ms
é chute. Se atrapalhar, cair para 1.500 ms ou remover.

## C-07 · Explicar com as próprias palavras

**Regra:** a prova Explicação exige texto do usuário. No MVP o texto é
armazenado e conta como prova sem avaliação automática; depois do MVP a Jane
avalia com rubrica.

**Evidência (moderada):** auto-explicação (Chi et al., 1994) e aprender
ensinando (Fiorella & Mayer, 2016) melhoram compreensão além da memorização.
Contar como prova sem avaliar é uma **hipótese** de produto, aceita porque o
custo de fraudar a si mesmo num sistema pessoal é baixo.

## C-08 · Resolução de problemas testa transferência

**Regra:** a prova Resolução de problemas só pode ser conquistada com uma
questão diferente da que conquistou a Autonomia no mesmo Ofício.

**Evidência (moderada):** Butler (2010): testes repetidos melhoram
transferência para questões novas sobre o mesmo conceito, mais do que reler.
Acertar a mesma questão duas vezes mede memória da questão, não do conceito.

**No código:** `review_logs.item_id` distinto do item da prova Autonomia.

## C-09 · Outro dia, não o mesmo dia (substituída)

**Regra original:** a prova "Outro dia" exigia data de calendário diferente da
primeira prova do Ofício.

**Situação:** a prova "Outro dia" saiu do desenho (D-022). O que ela protegia
(um acerto no mesmo dia tem alta chance de vir da memória de curto prazo; é
C-02 no nível do Ofício) agora é papel do FSRS e da revisão do Ofício
(C-03, C-17). A linha fica como história; não há mais regra no código.

## C-10 · Tempo cronometrado

**Regra:** a prova Fluência procedimental tem limite de
`TIMED_PROOF_SECONDS = 60`.

**Evidência (hipótese):** fluência sob pressão é um indicador de automatização
em algumas áreas (cálculo, por exemplo), mas o limite de 60 s é arbitrário e
inadequado para questões de Filosofia. Candidato a virar parâmetro por
matéria.

## C-11 · Distratores devem ser equívocos reais

**Regra:** em múltipla escolha, alternativas erradas representam erros
plausíveis. Alternativa absurda é recusada na revisão de conteúdo.

**Evidência (moderada):** Little & Bjork (2015): distratores competitivos
aumentam o benefício do teste e evitam que a questão se torne reconhecimento
trivial. Alternativa absurda infla o acerto e corrompe o cálculo de domínio.

## C-12 · Intercalar matérias na sessão

**Regra:** quando o tempo permite, o plano do dia alterna matérias em vez de
blocar uma só, respeitando os pesos.

**Evidência (moderada):** Rohrer & Taylor (2007) e Rohrer (2012) mostram ganho
em matemática ao intercalar tipos de problema. O efeito é mais claro para
problemas de categoria parecida; para matérias muito distintas, o ganho é
menos documentado. Por isso o plano intercala, mas não força.

**No código:** fora do MVP. A sessão do dia (D-024) tem blocos fixos e não
intercala; volta junto com o plano por tempo (`INTERLEAVE = true`,
`MAX_CONSECUTIVE_SAME_SUBJECT = 2`).

## C-13 · Dificuldade desejável, não frustração

**Regra (fora do MVP, volta com a fórmula de prioridade):** o Gregor prefere
Ofícios disponíveis com domínio entre 30% e 70% quando não há urgência; evita
empilhar só o que já está dominado ou só o que está no zero.

**Evidência (moderada):** "desirable difficulties" (Bjork, 1994): aprender
melhor quando a tarefa exige esforço, desde que o esforço seja produtivo. A
faixa 30–70% é **hipótese**; a ideia da zona intermediária é evidência.

## C-14 · Pré-requisitos reais, mastery antes de avançar

**Regra:** um Ofício só abre quando cada pré-requisito tem ≥ 2 dimensões
diferentes provadas (`UNLOCK_MIN_DIMENSIONS`, D-022). Pré-requisito é
dependência real, não ordem de apostila.

**Evidência (moderada):** aprendizagem para domínio (Bloom, 1968): avançar só
após demonstrar domínio do bloco anterior reduz lacunas acumuladas. O número 2
é **hipótese**. Exigir dimensões **diferentes** (e não duas provas quaisquer) é
a defesa contra o início a frio (C-15); não vem da literatura.

## C-15 · Poucas tentativas não são conhecimento

**Regra:** toda nota de domínio vem com índice de confiança. No MVP a
confiança é a cobertura de dimensões (dimensões ÷ 5), com uma penalidade
temporária por erro recente (D-022, D-027). O erro baixa a confiança, nunca as
dimensões já provadas.

**Evidência (moderada):** ilusões de competência (Koriat & Bjork, 2005): um
acerto isolado gera superestimação do próprio conhecimento. A fórmula é
**hipótese** de engenharia (`docs/03-gregor.md`). Honestidade: a versão
anterior multiplicava por tentativas e exigia cerca de cinco acertos para
liberar; a atual protege menos contra sorte (duas dimensões já liberam), e a
proteção vem de exigir dimensões diferentes.

## C-16 · Sequência de dias

**Regra:** a ofensiva conta dias com **qualquer tentativa registrada**, certa ou
errada (D-021). Ler material não conta. Dia perdido zera o contador, sem
proteção no MVP (D-027); pausa não é punida com perda de domínio.

**Evidência (fraca / hipótese):** formação de hábito depende de repetição em
contexto estável (Lally et al., 2010, com grande variação individual). Efeitos
de gamificação são mistos (Hamari et al., 2014). O streak existe porque o
usuário declarou que o ajuda a começar. Contar tentativa errada é uma escolha
de produto: o que importa é voltar a estudar, não acertar.

## C-17 · Esquecimento é a regra

**Regra:** Ofício cuja recuperabilidade média cai abaixo de
`RETENTION_TARGET = 0.9` ganha o marcador "Precisa revisar" e volta para as
revisões da sessão, mesmo Dominado. A prova conquistada não se perde.

**Evidência (forte):** curva do esquecimento (Ebbinghaus, 1885; replicada por
Murre & Dros, 2015). O valor 0,9 é **hipótese**; a recuperabilidade vem do FSRS
desde o MVP (C-03, D-023).

## C-18 · Provar o domínio de formas diferentes

**Regra:** o domínio de um Ofício é a cobertura de cinco dimensões: compreensão
conceitual, fluência procedimental, resolução de problemas, autonomia e
explicação (D-022). Liberar exige duas dimensões diferentes; Dominado exige as
cinco.

**Evidência (hipótese quanto ao conjunto):** a taxonomia de Bloom (Bloom et al.,
1956) e a revisão de Anderson & Krathwohl (2001) inspiram a ideia de que
compreender, aplicar e explicar são capacidades diferentes. As cinco dimensões
do Ateliê **não** são os níveis oficiais de Bloom: são um desenho do produto. É
moderada a evidência de que variar o tipo de tarefa mede transferência (C-08).

---

## O que não tem base e está no produto mesmo assim

Lista honesta, para não esquecer de revisar:

- Os números de ordenação, duração dos blocos e a penalidade de erro são
  hipótese. Os pesos `W_*` da fórmula de prioridade ficam para depois do MVP.
- "2 dimensões = Liberado, 5 = Dominado" é hipótese de produto.
- As 5 dimensões são um desenho de produto inspirado em C-01, C-07, C-08 e
  C-18; a combinação específica não tem estudo.
- XP e nível não têm base nenhuma (valores e curva são hipótese, A-008). Entram
  no MVP por decisão do Márcio (D-021), não por evidência.
- A meta de retenção de 0,9 e o limite de 60 s do cronômetro são hipótese.

Quando o uso real acumular alguns meses de `review_logs`, dá para testar parte
disso: por exemplo, se Ofícios com 5 dimensões de fato mantêm recuperabilidade
alta 30 dias depois. Esse é o critério para mexer nos números.
