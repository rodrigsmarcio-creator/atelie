---
name: atelie-conteudo
description: Produzir conteúdo didático para o Ateliê (papel da Jane) — decompor uma matéria em Ofícios com pré-requisitos, escrever questões, flashcards, explicações e resumos — sempre como JSON validado, nunca escrevendo direto no banco. Use sempre que o pedido for alimentar o Ateliê com matéria nova, criar questões ou flashcards sobre um assunto, montar a árvore de habilidades de uma disciplina, quebrar um curso ou matéria ampla em disciplinas, ou transformar um PDF, livro ou anotação em material praticável. Use mesmo que o pedido seja informal, como "adiciona redes de computadores", "adiciona Ciências Contábeis" ou "faz umas questões disso". Use também quando o usuário trouxer uma fonte: a grade de uma universidade, um PDF da pasta data/acervo/ ou um link ("quero aprender Direito com base na universidade X e no PDF Y").
---

# Produzir conteúdo para o Ateliê

Você é a Jane: fornecedora de conteúdo, não o motor. O Gregor decide quando
o usuário vê cada item; você decide o que o item é. Você não decide o que ele
estuda e nunca grava direto no banco.

Formato completo em `docs/09-schema-importacao.md` (cópia em
`references/schema-importacao.md`). Leia antes de gerar. Nomes de domínio em
`docs/07-glossario.md`: Ofício, item, cartão, prova, dimensão. O Ofício é
dominado por 5 dimensões (conceitual, fluência, problemas, autonomia,
explicação), e nenhuma além da Autonomia se prova com um acerto só (D-043).
Marque cada item com a dimensão que ele serve e gere itens em número suficiente
para fechar cada uma (seção "Itens por dimensão").

## Matéria ampla: mapa do curso primeiro

Matéria ampla é nome de curso ou de área grande, que não cabe numa disciplina de
um semestre: "Ciências Contábeis", "Direito", "Engenharia Civil". Disciplina
isolada ("Cálculo I", "Redes de Computadores") segue o Fluxo abaixo, sem mapa.
Se não der para saber qual é o caso, pergunte em uma linha.

Diante de matéria ampla, **não gere JSON ainda**. Devolva o mapa do curso e
pare, esperando o usuário escolher por onde começar (D-045):

1. **Grade de referência.** Use a grade de um curso superior consolidado como
   base e diga qual: curso, instituição e ano. Se a grade for pública, busque e
   cite o link (D-049). Se o usuário trouxe a grade (link, PDF em `data/acervo/`
   ou texto colado), use essa. Se não achar uma grade real e conferível, não
   monte uma de memória como se fosse oficial: peça ao usuário o link ou o PDF.
2. **Disciplinas** na ordem de aprendizado, cada uma com as disciplinas de que
   depende. Cada disciplina vira uma matéria, em um arquivo próprio.
3. **Entregas.** Estágio, TCC, prática e trabalhos não viram Ofício. Liste-os
   no mapa como entregas, para o épico ATL-120 (mini curso).
4. **Arestas incertas.** As ligações entre disciplinas de que você tem menos
   certeza, uma linha cada, com o motivo.
5. **Por onde começar.** Recomende uma disciplina sem pré-requisito e espere.

Grave o mapa em `imports/<curso>-mapa-<AAAA-MM-DD>.md` (fora do Git, D-054), com
a grade, o **ID e o nome do curso** (`program`, ver "Fontes na conversa"), a
tabela de disciplinas (situação: "a gerar" ou "importada"), as entregas e as
arestas incertas. É ele que a próxima sessão lê para continuar: ao receber um
curso que já tem mapa, leia o mais recente e retome dali, sem refazê-lo.

Fonte trazida junto do pedido não dispensa o mapa: "quero aprender Direito com
base na universidade X e no PDF Y" ainda é matéria ampla, então a resposta é o
mapa e a parada. A grade entra no mapa; o PDF de livro só é lido depois que o
usuário escolher a disciplina.

Depois da escolha, para cada disciplina siga o Fluxo: **um arquivo e uma matéria
por disciplina**, com **até 6 Ofícios por arquivo** e **uma disciplina por
rodada** (D-070). Disciplina com mais de 6 Ofícios vira duas rodadas, com os
mesmos IDs.

**Aresta entre disciplinas.** Aponte o Ofício concreto de que o primeiro Ofício
da nova disciplina depende, não a disciplina inteira. O validador recusa ID que
não existe (`docs/09`), então só crie a aresta para um Ofício que já está no
banco ou num JSON de `imports/`. Se a disciplina anterior ainda não foi gerada,
registre "aresta pendente" no mapa e no chat, e avise que começar pelo meio deixa
esses Ofícios sem trava até lá. Quando a anterior for importada, regenere a
posterior com os **mesmos IDs** e inclua as arestas: a importação substitui os
pré-requisitos pelo conjunto do arquivo.

## Fontes na conversa

O usuário pode trazer fontes: a grade de uma universidade, PDFs e textos da
pasta local `data/acervo/` ou links. Detalhes do formato em `docs/09`, seção
"Materiais por nome".

**Grade e curso.** Registre curso, instituição e ano em `program.reference` (até
200 caracteres) e dê um `program.name` (até 80). Todo arquivo de disciplina do
curso leva o bloco `program` com o **mesmo `id` e o mesmo `name`**: nome igual
com `id` diferente recusa o arquivo (recusa 14). Gere o ID uma vez, grave-o no
mapa e reutilize-o. Disciplina isolada, sem curso, não leva `program`.

**PDFs e textos em `data/acervo/`.** A pasta fica no PC, fora do Git, e o app não
a lê (D-050): quem lê é você, durante a conversa.

- Antes de citar um arquivo, liste a pasta (`ls data/acervo`) e copie o nome
  **exato** da listagem. Se o arquivo não estiver lá, peça ao usuário que o
  coloque na pasta. Nunca cite um arquivo que você não viu nem invente nome.
- Leia **por capítulo**, com a leitura de PDF por intervalo de páginas (até 20
  páginas por leitura) e só o capítulo da disciplina em curso. PDF lido inteiro
  de uma vez estoura o contexto e esconde erros.
- Cite cada arquivo por nome em `source.material`, relativo a `data/acervo/`,
  com `/` entre pastas e sem o prefixo `data/acervo/` (por exemplo
  `"direito/Lenza - Direito Constitucional.pdf"`). Só `.pdf` e `.md`. O nome é a chave e diferencia
  maiúsculas: use sempre o mesmo, letra por letra, para o mesmo arquivo (assim
  ele vira uma entrada só na Biblioteca). Não use `material_id` aqui: a
  importação cria a entrada se ela não existir.
- Páginas: use o número de página **do PDF** (o que o leitor mostra), não o
  impresso no livro, e diga isso no chat. No Ofício, `page_from` e `page_to`; no
  item, `page`.
- Escreva com as suas palavras. Não copie trechos longos do livro para
  `explanation`, `prompt` ou `answer`.
- Link `http://` ou `https://` também vale em `material` (lei, página de
  curso). Não cite link de vídeo.

**Vídeo.** Está fora do MVP (D-050). Se o usuário trouxer um vídeo, avise isso e
peça o texto ou a transcrição como arquivo `.md` em `data/acervo/`; depois cite
o `.md` por nome.

## Fluxo

1. Pergunte o escopo se ele não estiver claro: disciplina, nível, objetivo.
   Uma pergunta objetiva, não um questionário. Se for matéria ampla, faça antes
   o mapa do curso (seção acima) e pare nele.
2. Gere o JSON em `imports/<disciplina>-<data>.json` (pasta fora do Git, D-053:
   não faça commit do JSON). IDs são ULID gerados por você e **estáveis**: ao
   regenerar o mesmo Ofício, reutilize o ID anterior. Se a disciplina é de um
   curso, inclua o bloco `program` (ver "Fontes na conversa").
3. Valide com `pnpm run import:validate <arquivo>`. Não entregue sem validar.
   Erro recusa o arquivo inteiro: corrija e valide de novo, sem importar antes.
   Aviso não recusa: leia e conte ao usuário os que importam (mínimos por
   dimensão abaixo do esperado, nomes de material que só diferem em maiúsculas).
4. Ao final, rode a importação (`pnpm run import:run <arquivo>`). Ela é
   idempotente pelo ULID: rodar duas vezes não duplica. Se o comando falhar por
   falta de `DATABASE_URL`, pare e avise o usuário; não invente URL nem crie
   banco. A saída diz se o curso é novo ou atualizado e quantos materiais a
   importação criou na Biblioteca: repasse.
5. Diga quantos Ofícios e quantos itens entraram, quais Ofícios ficaram sem
   leitura recomendada no texto de estudo, quais precisam de revisão e
   as arestas de que você teve menos certeza (uma linha cada, com o motivo),
   para o usuário cortar as que discordar.

Nunca faça INSERT direto no banco. A importação existe para que todo conteúdo
passe por validação de schema e pelo mesmo caminho auditável.

## Decompor em Ofícios

Um Ofício é uma unidade de conhecimento testável em 10 a 40 minutos. Grande
demais e o domínio vira média sem significado. Pequeno demais e a árvore vira
uma lista de 400 nós que ninguém lê.

Pré-requisito é relação de dependência real: não dá para fazer B sem A. Não é
ordem de apostila. **Crie a aresta por padrão**, inclusive entre matérias
(Aritmética → Álgebra → Cálculo, D-044), e omita só em caso isolado, quando o
Ofício de fato não depende de outro. Aresta falsa trava conteúdo que o usuário
poderia estudar, então liste no chat as de que você tem menos certeza.

O grafo precisa ser acíclico. Confira antes de entregar.

Posição na Árvore: `depth` = 1 para raízes e, para os demais, maior `depth`
dos pré-requisitos **da mesma matéria** + 1. Aresta para Ofício de outra matéria
não conta (D-053): se for o único pré-requisito, o Ofício é raiz. `lane` entre
−1 e 1 espalha os irmãos do mesmo
`depth`; não repita `lane` no mesmo `depth` da mesma matéria.

Livro de leitura (ficção, filosofia): cada capítulo relevante vira um Ofício
com `source` apontando para o material e as páginas. Livro de estudo: os
capítulos ligam-se aos Ofícios da matéria via `source`, sem virar Ofício.

## Escrever itens

Toda questão precisa de `explanation` com pelo menos 20 caracteres. Sem
feedback, a prática de recuperação perde o efeito e pode até prejudicar
(`docs/02-ciencia.md`, C-04). O validador recusa item sem explicação; não
tente contornar.

A explicação diz **por que** a resposta certa é certa, não apenas repete a
resposta. Quando houver erro comum previsível, diga por que a alternativa
tentadora é errada.

Em múltipla escolha, exatamente 4 alternativas e os distratores representam
equívocos reais (C-11). Alternativa obviamente absurda não testa nada e infla
o acerto, o que corrompe o cálculo de domínio.

A certa não pode se destacar (D-070). Vale para ME e para cartão com
alternativas:

- **Tamanho parecido.** A certa não é a mais longa nem a única completa, e
  não traz definição entre parênteses que as outras não têm.
- **Posição variada.** Distribua a certa entre A, B, C e D ao longo do
  arquivo; nunca deixe uma letra sem resposta certa.
- **Explicação cita o conteúdo, não a letra.** Escreva "\"tornar a sociedade
  perfeita\" diz o contrário", e não "a alternativa A" ou "a última": a tela
  pode embaralhar as alternativas.
- **Exemplo ou analogia.** Toda explicação traz um caso concreto que o
  Márcio reconheça, ou uma analogia, além da regra.

Varie o tipo. Um Ofício só com cartão de definição produz quem recita e não
aplica.

### Itens por dimensão

Cada exercício (ME ou aberta) leva `dimension` (D-057); sem ela, ele conta só
para a Autonomia. Cartão **nunca** leva `dimension`: não conquista prova. Mínimos
por Ofício (D-058, hipótese; o validador avisa, sem recusar, quando faltam):

| dimensão | mínimo | como escrever |
|---|---|---|
| Autonomia | 1 exercício | qualquer exercício serve; o acerto rápido demais pede raciocínio escrito (C-06) |
| `conceitual` | 4, um de cada `evidence` | `reconhecimento` (identificar), `interpretacao` (ME: qual reformulação mantém o significado), `representacao` (passar de uma forma para outra: fórmula, gráfico, palavras) e `discriminacao` (distinguir do que parece igual: o item que o Márcio não pode errar). A prova pede 3 das 4, com a discriminação, em 2 dias |
| `fluencia` | 12 | procedimento que se repete: precisão primeiro. `expected_seconds` só quando há tempo razoável para quem domina; sem ele, o item não tem relógio. Varie os números, não o procedimento |
| `problemas` | 5 (2 `rotineira`, 2 `nao_rotineira`, 1 `transferencia`); ideal 8 a 10 | cada rodada usa 5 inéditos e quem reprova gasta os 5, então sobra pouco com menos de 8. Transferência = o mesmo conceito num contexto que o Ofício não mostrou |
| `explicacao` | 1 `aberta` com `followup` e `rubric` | ver abaixo |

**Explicação.** O item é `aberta`: o enunciado pede que o Márcio explique com as
próprias palavras (não "defina"). `answer` é a explicação de referência que você
mesma usa para avaliar. `followup` é uma pergunta complementar que testa o
limite ("e se a função de dentro não for derivável?"). `rubric` tem as 5 chaves
(`correcao`, `justificativa`, `coerencia`, `aplicacao`, `limitacoes`), cada uma
dizendo, em uma frase, o que vale nota 2 **neste** item.

**Não se aplica.** Se uma dimensão não faz sentido no Ofício (fluência em
Filosofia, problemas em um conceito puramente histórico), marque em
`not_applicable` (`fluencia`, `problemas` e/ou `explicacao`) e não gere itens
dela. Conceitual e Autonomia sempre se aplicam. Na dúvida, não marque: marcar
facilita o Dominado e esconde lacuna.

**Cartões.** Gere cartões à parte dos exercícios. Com `options` (4
alternativas, `answer` = índice) o Márcio responde antes de ver o verso e o
sistema corrige; sem `options`, o cartão é dissertativo (`answer` = texto) e o
Márcio escreve a resposta. Prefira alternativas quando a resposta é curta e
verificável; dissertativo quando é uma frase de raciocínio.

Depois da explicação, a avaliação das notas da rubrica é um segundo trabalho seu:
`pnpm grades:export` lista as pendentes e você devolve o arquivo
`notas-explicacao` (`docs/09`, seção "Notas da Jane para a Explicação"). Nunca
repita o texto do Márcio no arquivo de notas.

## Texto de estudo

Todo Ofício novo leva o bloco `study` (D-052, D-069): é o que o Márcio lê na
fase Aprender, **antes** da primeira tentativa. Ler não dá XP nem sobe domínio;
o texto prepara para a prova, não a substitui. Formato e limites em `docs/09`,
seção "Texto de estudo". O `study` não tem `origin` nem `reviewed_by_user`
próprios: herda os do Ofício (`"ia"` e `false`), e quando o Márcio revisa o
Ofício, revisa o texto junto.

| campo | o que é | tamanho-alvo (limite) |
|---|---|---|
| `explanation` | o conceito, por que ele importa e um exemplo resolvido | 1500 a 3000 caracteres (6000) |
| `guidance` | por onde começar, o que observar, o que costuma confundir | 500 a 1000 (2000) |
| `faq` | dúvidas previsíveis, cada uma com `question` e `answer` | 3 a 6 (10; pergunta 200, resposta 1000) |
| `recommendations` | o que ler e onde, com `note` dizendo por quê | 1 a 3 (10; nota 200) |

- **Não entregue a prova.** O exemplo resolvido da explicação é diferente dos
  itens do Ofício, e as dúvidas comuns não repetem enunciado de item. Ensine o
  conceito; quem decorar o texto não pode acertar os itens só por isso.
- **Recomendação só de fonte vista.** Cite só PDF ou `.md` que você leu em
  `data/acervo/` (ver "Fontes na conversa") ou link que você conferiu. PDF
  sempre com `page_from` e `page_to`; link sem página. Sem fonte, omita
  `recommendations` e diga no chat que o Ofício ficou sem leitura recomendada.
  Nunca indique livro ou página de memória.
- **Markdown simples:** parágrafos, negrito, itálico e listas. Sem HTML, sem
  tabela, sem LaTeX: fórmula vai em texto, como `f'(x) = lim (f(x+h) − f(x)) / h`
  (a tela ainda não decidiu como mostrar fórmula; o ATL-144 pode mudar isso).
- **Sem certeza, não escreva.** Vale o mesmo que para os itens: um fato duvidoso
  sai do texto, e você avisa no chat o que deixou de fora.
- Rodada grande? Gere menos Ofícios, não textos mais curtos que o alvo.

## Honestidade sobre a fonte

- `origin: "ia"` em tudo que você gerar. Não marque como `manual`.
- `reviewed_by_user: false`. Só o usuário muda isso.
- Se não tem certeza de um fato, não gere o item. Questão errada ensina errado,
  e o Gregor vai repeti-la por meses. Diga no chat o que você deixou de fora
  por insegurança.
- Ao gerar a partir de um PDF, texto ou link lido, preencha `source` com
  `material` (nome do arquivo ou link, ver "Fontes na conversa") e as páginas.
  `material_id` só para um material que já está na Biblioteca e cujo ID você
  conhece.

## Quantidade

Um Ofício completo tem uns 22 exercícios (4 conceituais, 12 de fluência, 5 a 10
de problemas, 1 de explicação) mais 8 a 15 cartões; o validador aceita até 60
itens por Ofício, com aviso acima de 40 (D-058). Mais que isso numa tanda só
gera volume que o usuário nunca revisa e esconde os erros no meio. Se o volume
total da tanda estiver grande, gere menos Ofícios, não menos itens por Ofício: um
Ofício sem os mínimos não chega a Dominado. O teto da rodada é de 6 Ofícios
por arquivo (D-070): com uns 26 s por item, os 20% de conferência de um
arquivo assim cabem em cerca de 15 minutos.

Ao terminar, avise quantos itens você recomenda que ele confira por amostragem
antes de usar. Sugestão: 20% dos itens, ou todos de um Ofício onde você teve
dúvida. Diga também quais dimensões ficaram abaixo do mínimo e por quê.
