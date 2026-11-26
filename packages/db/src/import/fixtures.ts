// Exemplos do docs/09-schema-importacao.md como dados de teste. Ficam em `src`
// porque o Dockerfile.test só copia `packages/db/src` (D-033). Os IDs do doc são
// legíveis de propósito: o formato aceito é "26 caracteres maiúsculos A–Z e
// 0–9", não o ULID estrito.

// "Exemplo mínimo" do doc.
export const exampleMinimo = {
  version: 1,
  generated_at: '2026-11-16T09:00:00Z',
  generated_by: 'claude-code/atelie-conteudo',
  subject: {
    id: '01JCXAM0000000000000SUBJ01',
    name: 'Cálculo I',
    short_name: 'Cálculo',
    color: '#5b8fd9',
    icon: 'sigma',
    weight: 40,
    exam_at: '2026-11-22',
  },
  skills: [
    {
      id: '01JCXAM0000000000000SK0001',
      name: 'Derivadas',
      description: 'Definição pela reta tangente, regras básicas, produto e quociente.',
      icon: 'func',
      depth: 1,
      lane: 0,
      estimated_minutes: 30,
      prereqs: [],
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000SK0002',
      name: 'Regra da cadeia',
      description: 'Derivada de função composta: derive a de fora, multiplique pela de dentro.',
      icon: 'link',
      depth: 2,
      lane: -0.4,
      estimated_minutes: 30,
      prereqs: ['01JCXAM0000000000000SK0001'],
      origin: 'ia',
      reviewed_by_user: false,
      source: { material_id: '01JCXAM0000000000000MAT001', page_from: 198, page_to: 210 },
    },
  ],
  items: [
    {
      id: '01JCXAM0000000000000IT0001',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'multipla_escolha',
      dimension: 'fluencia',
      expected_seconds: 60,
      prompt: 'Calcule a derivada de f(x) = (3x² + 1)⁵.',
      options: ['5(3x² + 1)⁴', '30x(3x² + 1)⁴', '15x(3x² + 1)⁴', '6x(3x² + 1)⁵'],
      answer: 1,
      explanation:
        'Fora: 5(3x²+1)⁴. Dentro: a derivada de 3x²+1 é 6x. O produto dá 30x(3x²+1)⁴. A alternativa A esquece de multiplicar pela derivada de dentro, que é o erro mais comum.',
      difficulty: 2,
      origin: 'ia',
      reviewed_by_user: false,
      source: { material_id: '01JCXAM0000000000000MAT001', page: 201 },
    },
    {
      id: '01JCXAM0000000000000IT0003',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'multipla_escolha',
      dimension: 'conceitual',
      evidence: 'discriminacao',
      prompt: 'Por que a regra da cadeia multiplica pela derivada da função de dentro?',
      options: [
        'Porque a derivada de um produto é o produto das derivadas',
        'Porque taxas de variação encadeadas se multiplicam: dy/dx = dy/du · du/dx',
        'Porque a função de dentro é sempre linear',
        'Por convenção, para simplificar a conta',
      ],
      answer: 1,
      explanation:
        'Se y muda dy/du vezes mais rápido que u, e u muda du/dx vezes mais rápido que x, então y muda o produto das duas taxas em relação a x. A alternativa A confunde com a regra do produto, que não é o produto das derivadas.',
      difficulty: 2,
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0002',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'cartao',
      prompt: 'Regra da cadeia em uma frase',
      answer:
        'Derive a função de fora mantendo a de dentro, depois multiplique pela derivada da de dentro.',
      explanation:
        'É a multiplicação de taxas de variação encadeadas: se y depende de u e u depende de x, dy/dx = dy/du · du/dx.',
      origin: 'ia',
      reviewed_by_user: false,
    },
  ],
};

// "Exemplo com as provas" do doc: um item de cada tipo que as provas pedem. O
// Ofício SK0001 (pré-requisito) já está no banco.
export const exampleProvas = {
  version: 1,
  generated_at: '2026-12-02T09:00:00Z',
  generated_by: 'claude-code/atelie-conteudo',
  subject: {
    id: '01JCXAM0000000000000SUBJ01',
    name: 'Cálculo I',
    short_name: 'Cálculo',
    color: '#5b8fd9',
    icon: 'sigma',
  },
  skills: [
    {
      id: '01JCXAM0000000000000SK0002',
      name: 'Regra da cadeia',
      description: 'Derivada de função composta: derive a de fora, multiplique pela de dentro.',
      icon: 'link',
      depth: 2,
      lane: -0.4,
      estimated_minutes: 30,
      prereqs: ['01JCXAM0000000000000SK0001'],
      not_applicable: [],
      origin: 'ia',
      reviewed_by_user: false,
    },
  ],
  items: [
    {
      id: '01JCXAM0000000000000IT0011',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'multipla_escolha',
      dimension: 'conceitual',
      evidence: 'reconhecimento',
      prompt: 'Qual destas funções é uma composição de duas funções?',
      options: ['f(x) = 3x² + 1', 'f(x) = sen(x²)', 'f(x) = x · sen(x)', 'f(x) = x² + sen(x)'],
      answer: 1,
      explanation:
        'sen(x²) aplica x² primeiro e depois sen. As outras três combinam funções por soma ou produto, sem aplicar uma dentro da outra; a C parece composição por ter duas funções, mas é um produto.',
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0012',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'multipla_escolha',
      dimension: 'conceitual',
      evidence: 'discriminacao',
      prompt: 'Qual derivada precisa da regra da cadeia?',
      options: ['d/dx de x⁵', 'd/dx de x · sen(x)', 'd/dx de sen(5x)', 'd/dx de x² + sen(x)'],
      answer: 2,
      explanation:
        'Só sen(5x) tem uma função dentro de outra. A B pede a regra do produto e a D, a da soma; ambas parecem mais complicadas, mas derivam cada fator ou parcela separadamente.',
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0021',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'aberta',
      dimension: 'fluencia',
      expected_seconds: 60,
      prompt: 'Derive f(x) = (2x + 1)⁴.',
      answer: '8(2x + 1)³',
      explanation:
        'Fora: 4(2x+1)³. Dentro: a derivada de 2x+1 é 2. O produto dá 8(2x+1)³; esquecer o fator 2 é o erro mais comum.',
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0031',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'aberta',
      dimension: 'problemas',
      category: 'rotineira',
      prompt: 'Derive f(x) = (x² + 3x)⁶.',
      answer: '6(x² + 3x)⁵ · (2x + 3)',
      explanation:
        'Mesma estrutura do procedimento treinado: fora 6(x²+3x)⁵, dentro 2x+3. Serve para a rodada porque o Ofício já mostrou esse caso.',
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0032',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'aberta',
      dimension: 'problemas',
      category: 'transferencia',
      prompt:
        'Um balão esférico enche a 100 cm³/s. Com que rapidez o raio cresce quando r = 5 cm? (V = 4/3 π r³)',
      answer: 'dr/dt = 1/π cm/s: dV/dt = 4π r² · dr/dt, então 100 = 100π · dr/dt.',
      explanation:
        'O Ofício não mostrou taxas relacionadas: o Márcio precisa reconhecer que r depende do tempo e aplicar a regra da cadeia em V(r(t)). Quem só decorou o procedimento não monta a equação.',
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0041',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'aberta',
      dimension: 'explicacao',
      prompt:
        'Explique com suas palavras por que a regra da cadeia multiplica pela derivada da função de dentro.',
      followup:
        'E se a função de dentro não for derivável num ponto? O que acontece com a derivada da composta?',
      answer:
        'Se y muda dy/du vezes mais rápido que u, e u muda du/dx vezes mais rápido que x, então y muda o produto das duas taxas em relação a x. Se a de dentro não é derivável num ponto, a regra não vale ali e a composta pode não ser derivável.',
      explanation:
        'A explicação de referência liga a regra à multiplicação de taxas de variação encadeadas e marca o limite de validade.',
      rubric: {
        correcao: 'Diz que as taxas se multiplicam, sem confundir com a regra do produto.',
        justificativa: 'Explica por quê, com a ideia de taxas encadeadas (dy/du · du/dx).',
        coerencia: 'Os passos seguem uma ordem lógica, sem contradição.',
        aplicacao: 'Dá ou usa um exemplo concreto, como (3x²+1)⁵.',
        limitacoes: 'Na pergunta complementar, diz que a regra exige a de dentro derivável.',
      },
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0051',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'cartao',
      options: [
        'Derivar a de fora e multiplicar pela derivada da de dentro',
        'Derivar as duas e somar',
        'Derivar as duas e multiplicar',
        'Derivar só a de dentro',
      ],
      answer: 0,
      prompt: 'Regra da cadeia: o que fazer com f(g(x))?',
      explanation:
        "É a multiplicação de taxas encadeadas: f'(g(x)) · g'(x). Derivar as duas e multiplicar esquece de manter a de dentro dentro da de fora.",
      origin: 'ia',
      reviewed_by_user: false,
    },
    {
      id: '01JCXAM0000000000000IT0052',
      skill_id: '01JCXAM0000000000000SK0002',
      kind: 'cartao',
      prompt: 'Por que (3x²+1)⁵ não se deriva só como 5(3x²+1)⁴?',
      answer: 'Falta multiplicar pela derivada da de dentro, 6x: o resultado certo é 30x(3x²+1)⁴.',
      explanation:
        'O cartão dissertativo pede que o Márcio escreva o erro comum com as próprias palavras antes de ver o verso.',
      origin: 'ia',
      reviewed_by_user: false,
    },
  ],
};

// Exemplo de arquivo de notas da Jane do doc.
export const exampleNotas = {
  version: 1,
  type: 'notas_explicacao',
  generated_at: '2026-12-02T21:30:00Z',
  generated_by: 'claude-code/atelie-conteudo',
  grades: [
    {
      id: '01JCXGRD000000000000GRD001',
      review_log_id: '01JCXLOG000000000000LOG001',
      correcao: 2,
      justificativa: 2,
      coerencia: 2,
      aplicacao: 1,
      limitacoes: 1,
      feedback:
        'Boa justificativa pela multiplicação das taxas. Faltou dizer quando a regra não se aplica (função de dentro não derivável).',
    },
  ],
};

// Posição de uma lista de exemplo. O tsconfig trata índice como possivelmente
// indefinido, e o teste prefere falhar alto a seguir com `undefined`.
export function at<T>(list: readonly T[], index: number): T {
  const entry = list[index];
  if (entry === undefined) throw new Error(`o exemplo não tem a posição ${index}`);
  return entry;
}

// "Exemplo com curso, material por nome e texto de estudo" do doc. Passa no
// formato, mas `items` está vazio (a regra 8 recusaria o arquivo inteiro); o
// pré-requisito SK0900 é de outra matéria do mesmo curso, já importada.
export const exampleCursoEstudo = {
  version: 1,
  generated_at: '2026-11-24T09:00:00Z',
  generated_by: 'claude-code/atelie-conteudo',
  program: {
    id: '01JCXD00000000000000PRG001',
    name: 'Direito',
    reference: 'Direito, USP, grade 2025',
  },
  subject: {
    id: '01JCXD00000000000000SBJ001',
    name: 'Direito Constitucional I',
    short_name: 'Constitucional',
    color: '#b5835a',
    icon: 'scale',
  },
  skills: [
    {
      id: '01JCXD00000000000000SK0001',
      name: 'Poder constituinte',
      description:
        'Quem cria a Constituição, com que limites, e a diferença entre poder originário e derivado.',
      icon: 'quill',
      depth: 1,
      lane: 0,
      estimated_minutes: 30,
      prereqs: ['01JCXD00000000000000SK0900'],
      origin: 'ia',
      reviewed_by_user: false,
      source: {
        material: 'direito/Lenza - Direito Constitucional.pdf',
        page_from: 180,
        page_to: 196,
      },
      study: {
        explanation:
          'O **poder constituinte originário** cria a Constituição e não tem limite jurídico anterior. O **derivado** altera a Constituição dentro das regras que ela mesma fixa.',
        recommendations: [
          {
            material: 'direito/Lenza - Direito Constitucional.pdf',
            page_from: 180,
            page_to: 196,
            note: 'Capítulo base do Ofício.',
          },
          {
            material: 'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
            note: 'Art. 60: limites ao poder de reforma.',
          },
        ],
        guidance:
          'Leia o capítulo antes do art. 60 e compare as cláusulas pétreas com os limites formais.',
        faq: [
          {
            question: 'Emenda constitucional é poder originário?',
            answer:
              'Não. Emenda é poder derivado reformador e precisa respeitar o art. 60, inclusive as cláusulas pétreas.',
          },
        ],
      },
    },
  ],
  items: [],
};
