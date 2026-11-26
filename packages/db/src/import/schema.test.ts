import { describe, expect, test } from 'vitest';
import { at, exampleMinimo, exampleNotas, exampleProvas } from './fixtures';
import { parseImportFile, ulidSchema, type ImportIssue } from './schema';

// Atalhos para montar variações do arquivo de exemplo.
const clone = <T>(value: T): T => structuredClone(value);

// Copia a lista trocando campos de uma posição (sem mutar o exemplo).
function patchAt(list: readonly object[], index: number, patch: Record<string, unknown>) {
  return list.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
}

function errorsOf(raw: unknown): ImportIssue[] {
  const result = parseImportFile(raw);
  return result.ok ? [] : result.errors;
}

function without(obj: object, key: string): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([name]) => name !== key));
}

// Arquivo de exemplo (Cálculo, com as provas) com um único item no lugar dos itens.
function fileWithItem(item: unknown) {
  return { ...clone(exampleProvas), items: [item] };
}

function fileWithSkill(skill: unknown) {
  return { ...clone(exampleProvas), skills: [skill] };
}

// Itens-base do exemplo das provas, por posição.
const conceitual = at(exampleProvas.items, 0); // ME, dimension conceitual, evidence reconhecimento
const fluencia = at(exampleProvas.items, 2); // aberta, fluência com expected_seconds
const problema = at(exampleProvas.items, 3); // aberta, problemas rotineira
const explicacao = at(exampleProvas.items, 5); // aberta, explicação com followup e rubric
const cartaoAlternativas = at(exampleProvas.items, 6);
const cartaoDissertativo = at(exampleProvas.items, 7);
const skillBase = at(exampleProvas.skills, 0);

function expectOneError(raw: unknown, path: string, text: string) {
  const errors = errorsOf(raw);
  expect(errors).toContainEqual({ path, message: expect.stringContaining(text) });
}

describe('formato do ID', () => {
  test.each(['01JCXAM0000000000000SUBJ01', '01JCXAM0000000000000IT0001', '0'.repeat(26)])(
    'aceita %s',
    (id) => {
      expect(ulidSchema.safeParse(id).success).toBe(true);
    },
  );

  test.each([
    ['minúsculas', '01jcxam0000000000000subj01'],
    ['25 caracteres', '01JCXAM000000000000SUBJ01'],
    ['27 caracteres', '01JCXAM00000000000000SUBJ01'],
    ['hífen', '01JCXAM-000000000000SUBJ01'],
    ['vazio', ''],
  ])('recusa %s', (_nome, id) => {
    expect(ulidSchema.safeParse(id).success).toBe(false);
  });
});

describe('arquivo de conteúdo: exemplos do docs/09', () => {
  test('o exemplo mínimo valida', () => {
    const result = parseImportFile(exampleMinimo);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.type).toBe('conteudo');
  });

  test('o exemplo das provas valida (todas as dimensões, cartões com e sem alternativas)', () => {
    expect(errorsOf(exampleProvas)).toEqual([]);
  });

  test('a lista de itens e de Ofícios pode ser vazia (arquivo só com itens, por exemplo)', () => {
    expect(errorsOf({ ...clone(exampleMinimo), skills: [], items: [] })).toEqual([]);
  });
});

describe('arquivo de conteúdo: raiz (recusa 1)', () => {
  test.each([2, 0, '1', null])('version %j é recusada', (version) => {
    expectOneError({ ...clone(exampleMinimo), version }, 'version', 'version deve ser 1');
  });

  test('version ausente é recusada', () => {
    expectOneError(without(exampleMinimo, 'version'), 'version', 'version deve ser 1');
  });

  test('generated_at fora do formato ISO em UTC', () => {
    expectOneError({ ...clone(exampleMinimo), generated_at: '16/11/2026' }, 'generated_at', 'ISO');
  });

  test('generated_by vazio', () => {
    expect(errorsOf({ ...clone(exampleMinimo), generated_by: '' }).map((e) => e.path)).toEqual([
      'generated_by',
    ]);
  });

  test('campo desconhecido na raiz aponta o nome do campo', () => {
    expectOneError({ ...clone(exampleMinimo), extra: 1 }, 'extra', 'campo desconhecido');
  });

  test('o que não é objeto é recusado', () => {
    expectOneError('texto', '', 'objeto JSON');
    expectOneError(null, '', 'objeto JSON');
    expectOneError([], '', 'objeto JSON');
  });
});

describe('arquivo de conteúdo: subject', () => {
  const subject = exampleMinimo.subject;
  const withSubject = (patch: Record<string, unknown>) => ({
    ...clone(exampleMinimo),
    subject: { ...subject, ...patch },
  });

  test('só id, name, color e icon são obrigatórios', () => {
    const minimo = { id: subject.id, name: subject.name, color: subject.color, icon: subject.icon };
    expect(errorsOf({ ...clone(exampleMinimo), subject: minimo })).toEqual([]);
  });

  test.each([
    ['id inválido', { id: 'abc' }, 'subject.id'],
    ['name vazio', { name: '' }, 'subject.name'],
    ['name com 81 caracteres', { name: 'a'.repeat(81) }, 'subject.name'],
    ['short_name com 21 caracteres', { short_name: 'a'.repeat(21) }, 'subject.short_name'],
    ['color sem #', { color: '5b8fd9' }, 'subject.color'],
    ['color com 3 dígitos', { color: '#fff' }, 'subject.color'],
    ['weight 101', { weight: 101 }, 'subject.weight'],
    ['weight -1', { weight: -1 }, 'subject.weight'],
    ['weight decimal', { weight: 10.5 }, 'subject.weight'],
    ['exam_at fora de AAAA-MM-DD', { exam_at: '22/11/2026' }, 'subject.exam_at'],
    ['icon vazio', { icon: '' }, 'subject.icon'],
  ])('recusa %s', (_nome, patch, path) => {
    expect(errorsOf(withSubject(patch)).map((e) => e.path)).toEqual([path]);
  });

  test('aceita name com 80 caracteres e weight 0 e 100', () => {
    expect(errorsOf(withSubject({ name: 'a'.repeat(80), weight: 0 }))).toEqual([]);
    expect(errorsOf(withSubject({ weight: 100 }))).toEqual([]);
  });
});

describe('arquivo de conteúdo: Ofício', () => {
  const withPatch = (patch: Record<string, unknown>) => fileWithSkill({ ...skillBase, ...patch });

  test.each([
    ['name vazio', { name: '' }, 'skills[0].name'],
    ['name com 81 caracteres', { name: 'a'.repeat(81) }, 'skills[0].name'],
    ['label com 25 caracteres', { label: 'a'.repeat(25) }, 'skills[0].label'],
    ['description com 301 caracteres', { description: 'a'.repeat(301) }, 'skills[0].description'],
    ['depth 0', { depth: 0 }, 'skills[0].depth'],
    ['depth decimal', { depth: 1.5 }, 'skills[0].depth'],
    ['lane acima de 1', { lane: 1.01 }, 'skills[0].lane'],
    ['lane abaixo de -1', { lane: -1.01 }, 'skills[0].lane'],
    ['estimated_minutes 9', { estimated_minutes: 9 }, 'skills[0].estimated_minutes'],
    ['estimated_minutes 41', { estimated_minutes: 41 }, 'skills[0].estimated_minutes'],
    ['origin desconhecida', { origin: 'import' }, 'skills[0].origin'],
    ['reviewed_by_user como texto', { reviewed_by_user: 'false' }, 'skills[0].reviewed_by_user'],
    ['prereq com ID inválido', { prereqs: ['x'] }, 'skills[0].prereqs[0]'],
    ['prereqs que não é lista', { prereqs: 'x' }, 'skills[0].prereqs'],
  ])('recusa %s', (_nome, patch, path) => {
    expect(errorsOf(withPatch(patch)).map((e) => e.path)).toEqual([path]);
  });

  test('aceita os limites: label 24, description 300, depth 1, lane -1 e 1, 10 e 40 minutos', () => {
    expect(
      errorsOf(withPatch({ label: 'a'.repeat(24), description: 'a'.repeat(300), lane: -1 })),
    ).toEqual([]);
    expect(errorsOf(withPatch({ depth: 1, lane: 1, estimated_minutes: 10 }))).toEqual([]);
    expect(errorsOf(withPatch({ estimated_minutes: 40 }))).toEqual([]);
  });

  test('description, label, source e not_applicable são opcionais', () => {
    const skill = without(without(skillBase, 'description'), 'not_applicable');
    expect(errorsOf(fileWithSkill(skill))).toEqual([]);
  });

  test('o caminho do erro aponta o Ofício certo', () => {
    const file = {
      ...exampleMinimo,
      skills: patchAt(exampleMinimo.skills, 1, {
        prereqs: ['01JCXAM0000000000000SK0001', 'errado'],
      }),
    };
    expectOneError(file, 'skills[1].prereqs[1]', 'ID inválido');
  });

  describe('source', () => {
    const source = { material_id: '01JCXAM0000000000000MAT001', page_from: 198, page_to: 210 };

    test('aceita material_id com ou sem páginas', () => {
      expect(errorsOf(withPatch({ source }))).toEqual([]);
      expect(errorsOf(withPatch({ source: { material_id: source.material_id } }))).toEqual([]);
    });

    test('recusa page_from maior que page_to', () => {
      expectOneError(
        withPatch({ source: { ...source, page_from: 211 } }),
        'skills[0].source.page_to',
        'page_from não pode ser maior que page_to',
      );
    });

    test.each([0, -1, 1.5])('recusa página %j', (page) => {
      expect(
        errorsOf(withPatch({ source: { ...source, page_from: page, page_to: 300 } })).map(
          (e) => e.path,
        ),
      ).toEqual(['skills[0].source.page_from']);
    });

    test('recusa material_id inválido', () => {
      expect(errorsOf(withPatch({ source: { material_id: 'x' } })).map((e) => e.path)).toEqual([
        'skills[0].source.material_id',
      ]);
    });
  });

  describe('not_applicable (recusa 20)', () => {
    test.each([[[]], [['fluencia']], [['fluencia', 'problemas', 'explicacao']]])(
      'aceita %j',
      (not_applicable) => {
        expect(errorsOf(withPatch({ not_applicable }))).toEqual([]);
      },
    );

    test.each(['conceitual', 'autonomia'])('recusa "%s", que sempre se aplica', (value) => {
      expectOneError(
        withPatch({ not_applicable: [value] }),
        'skills[0].not_applicable[0]',
        'sempre se aplicam',
      );
    });

    test('recusa valor desconhecido', () => {
      expectOneError(
        withPatch({ not_applicable: ['escrita'] }),
        'skills[0].not_applicable[0]',
        'dimensão desconhecida',
      );
    });

    test('recusa valor repetido', () => {
      expectOneError(
        withPatch({ not_applicable: ['fluencia', 'fluencia'] }),
        'skills[0].not_applicable',
        'não pode repetir',
      );
    });
  });
});

describe('arquivo de conteúdo: item', () => {
  const withPatch = (base: object, patch: Record<string, unknown>) =>
    fileWithItem({ ...base, ...patch });

  test('o item mínimo (cartão sem alternativas) valida só com os campos obrigatórios', () => {
    expect(errorsOf(fileWithItem(cartaoDissertativo))).toEqual([]);
  });

  describe('campos básicos (recusa 6)', () => {
    test('explanation ausente', () => {
      expect(
        errorsOf(fileWithItem(without(cartaoDissertativo, 'explanation'))).map((e) => e.path),
      ).toEqual(['items[0].explanation']);
    });

    test('explanation com 19 caracteres', () => {
      expectOneError(
        withPatch(cartaoDissertativo, { explanation: 'a'.repeat(19) }),
        'items[0].explanation',
        'ao menos 20 caracteres',
      );
    });

    test('explanation com 20 caracteres', () => {
      expect(errorsOf(withPatch(cartaoDissertativo, { explanation: 'a'.repeat(20) }))).toEqual([]);
    });

    test.each([
      ['prompt vazio', { prompt: '' }, 'items[0].prompt'],
      ['prompt com 1001 caracteres', { prompt: 'a'.repeat(1001) }, 'items[0].prompt'],
      ['kind desconhecido', { kind: 'dissertativa' }, 'items[0].kind'],
      ['difficulty 0', { difficulty: 0 }, 'items[0].difficulty'],
      ['difficulty 4', { difficulty: 4 }, 'items[0].difficulty'],
      ['skill_id inválido', { skill_id: 'x' }, 'items[0].skill_id'],
      ['origin desconhecida', { origin: 'import' }, 'items[0].origin'],
      ['tags que não é lista', { tags: 'a' }, 'items[0].tags'],
      [
        'source sem page',
        { source: { material_id: '01JCXAM0000000000000MAT001' } },
        'items[0].source.page',
      ],
      [
        'source com page 0',
        { source: { material_id: '01JCXAM0000000000000MAT001', page: 0 } },
        'items[0].source.page',
      ],
    ])('recusa %s', (_nome, patch, path) => {
      expect(errorsOf(withPatch(cartaoDissertativo, patch)).map((e) => e.path)).toEqual([path]);
    });

    test('aceita prompt com 1000 caracteres, difficulty 1 e 3 e tags', () => {
      expect(
        errorsOf(
          withPatch(cartaoDissertativo, {
            prompt: 'a'.repeat(1000),
            difficulty: 1,
            tags: ['a', 'b'],
          }),
        ),
      ).toEqual([]);
      expect(errorsOf(withPatch(cartaoDissertativo, { difficulty: 3 }))).toEqual([]);
    });

    test('o caminho do erro aponta o item certo', () => {
      const file = { ...exampleMinimo, items: patchAt(exampleMinimo.items, 2, { prompt: '' }) };
      expectOneError(file, 'items[2].prompt', 'esperava');
    });
  });

  describe('options e answer por tipo (recusa 7)', () => {
    test('múltipla escolha exige exatamente 4 alternativas', () => {
      expectOneError(
        withPatch(conceitual, { options: ['a', 'b', 'c'] }),
        'items[0].options',
        'exatamente 4',
      );
      expectOneError(
        withPatch(conceitual, { options: ['a', 'b', 'c', 'd', 'e'] }),
        'items[0].options',
        'exatamente 4',
      );
      expectOneError(
        fileWithItem(without(conceitual, 'options')),
        'items[0].options',
        'exatamente 4',
      );
    });

    test('cartão com options precisa de 4; sem options é dissertativo', () => {
      expectOneError(
        withPatch(cartaoAlternativas, { options: ['a', 'b'] }),
        'items[0].options',
        'exatamente 4',
      );
      expect(errorsOf(fileWithItem(cartaoAlternativas))).toEqual([]);
      expect(errorsOf(fileWithItem(cartaoDissertativo))).toEqual([]);
    });

    test('aberta não pode ter options', () => {
      expectOneError(
        withPatch(fluencia, { options: ['a', 'b', 'c', 'd'] }),
        'items[0].options',
        'não pode ter',
      );
    });

    test.each([4, -1, 1.5, '1', 'texto'])('answer %j é recusada em múltipla escolha', (answer) => {
      expectOneError(withPatch(conceitual, { answer }), 'items[0].answer', '0 a 3');
    });

    test.each([0, 1, 2, 3])('answer %j é aceita em múltipla escolha', (answer) => {
      expect(errorsOf(withPatch(conceitual, { answer }))).toEqual([]);
    });

    test('cartão de alternativas exige número em answer', () => {
      expectOneError(
        withPatch(cartaoAlternativas, { answer: 'texto' }),
        'items[0].answer',
        '0 a 3',
      );
      expectOneError(withPatch(cartaoAlternativas, { answer: 4 }), 'items[0].answer', '0 a 3');
    });

    test('cartão dissertativo e aberta exigem texto em answer', () => {
      expectOneError(withPatch(cartaoDissertativo, { answer: 1 }), 'items[0].answer', 'texto');
      expectOneError(withPatch(cartaoDissertativo, { answer: '' }), 'items[0].answer', 'texto');
      expectOneError(withPatch(fluencia, { answer: 2 }), 'items[0].answer', 'texto');
    });

    test('answer ausente', () => {
      expect(errorsOf(fileWithItem(without(fluencia, 'answer'))).map((e) => e.path)).toContain(
        'items[0].answer',
      );
    });
  });

  describe('dimension e campos dela (recusas 10 e 17)', () => {
    test('focus é recusado com a mensagem de que virou dimension', () => {
      expectOneError(
        withPatch(cartaoDissertativo, { focus: 'conceitual' }),
        'items[0].focus',
        'substituído por "dimension"',
      );
    });

    test('dimension desconhecida', () => {
      expect(
        errorsOf(withPatch(fluencia, { dimension: 'autonomia' })).map((e) => e.path),
      ).toContain('items[0].dimension');
    });

    test('dimension em cartão', () => {
      expectOneError(
        withPatch(cartaoDissertativo, { dimension: 'fluencia' }),
        'items[0].dimension',
        'cartão não tem "dimension"',
      );
    });

    test('exercício sem dimension é válido (conta só para a Autonomia)', () => {
      const semDimensao = without(without(fluencia, 'dimension'), 'expected_seconds');
      expect(errorsOf(fileWithItem(semDimensao))).toEqual([]);
    });

    test('conceitual exige evidence', () => {
      expectOneError(
        fileWithItem(without(conceitual, 'evidence')),
        'items[0].evidence',
        'exige "evidence"',
      );
    });

    test('evidence fora de dimension conceitual', () => {
      expectOneError(
        withPatch(fluencia, { evidence: 'reconhecimento' }),
        'items[0].evidence',
        'só vale com dimension "conceitual"',
      );
      expectOneError(
        withPatch(without(fluencia, 'dimension'), { evidence: 'reconhecimento' }),
        'items[0].evidence',
        'só vale com dimension "conceitual"',
      );
    });

    test('evidence desconhecida', () => {
      expect(errorsOf(withPatch(conceitual, { evidence: 'memoria' })).map((e) => e.path)).toEqual([
        'items[0].evidence',
      ]);
    });

    test.each(['reconhecimento', 'representacao', 'discriminacao'])(
      'evidence %s vale em aberta',
      (evidence) => {
        expect(
          errorsOf(
            withPatch(conceitual, {
              kind: 'aberta',
              options: undefined,
              answer: 'texto',
              evidence,
            }),
          ),
        ).toEqual([]);
      },
    );

    test('interpretacao só vale em múltipla escolha (recusa 18)', () => {
      expect(errorsOf(withPatch(conceitual, { evidence: 'interpretacao' }))).toEqual([]);
      expectOneError(
        withPatch(conceitual, {
          kind: 'aberta',
          options: undefined,
          answer: 'texto',
          evidence: 'interpretacao',
        }),
        'items[0].evidence',
        'só vale em múltipla escolha',
      );
    });

    test('problemas exige category e category só vale em problemas', () => {
      expectOneError(
        fileWithItem(without(problema, 'category')),
        'items[0].category',
        'exige "category"',
      );
      expectOneError(
        withPatch(fluencia, { category: 'rotineira' }),
        'items[0].category',
        'só vale com dimension "problemas"',
      );
      expect(errorsOf(withPatch(problema, { category: 'nao_rotineira' }))).toEqual([]);
      expect(errorsOf(withPatch(problema, { category: 'transferencia' }))).toEqual([]);
      expect(errorsOf(withPatch(problema, { category: 'dificil' })).map((e) => e.path)).toEqual([
        'items[0].category',
      ]);
    });

    test('expected_seconds só vale em fluência, é opcional e vai de 1 a 3600', () => {
      expect(errorsOf(fileWithItem(without(fluencia, 'expected_seconds')))).toEqual([]);
      expectOneError(
        withPatch(problema, { expected_seconds: 60 }),
        'items[0].expected_seconds',
        'só vale com dimension "fluencia"',
      );
      expect(errorsOf(withPatch(fluencia, { expected_seconds: 1 }))).toEqual([]);
      expect(errorsOf(withPatch(fluencia, { expected_seconds: 3600 }))).toEqual([]);
      expect(errorsOf(withPatch(fluencia, { expected_seconds: 0 })).map((e) => e.path)).toEqual([
        'items[0].expected_seconds',
      ]);
      expect(errorsOf(withPatch(fluencia, { expected_seconds: 3601 })).map((e) => e.path)).toEqual([
        'items[0].expected_seconds',
      ]);
    });

    test('explicação exige followup e rubric, e só vale em explicação', () => {
      expectOneError(
        fileWithItem(without(explicacao, 'followup')),
        'items[0].followup',
        'exige "followup"',
      );
      expectOneError(
        fileWithItem(without(explicacao, 'rubric')),
        'items[0].rubric',
        'exige "rubric"',
      );
      expectOneError(
        withPatch(fluencia, { followup: 'E se...?' }),
        'items[0].followup',
        'só vale com dimension "explicacao"',
      );
      expectOneError(
        withPatch(fluencia, { rubric: explicacao.rubric }),
        'items[0].rubric',
        'só vale com dimension "explicacao"',
      );
    });

    test('followup vai de 1 a 500 caracteres', () => {
      expect(errorsOf(withPatch(explicacao, { followup: 'a'.repeat(500) }))).toEqual([]);
      expect(
        errorsOf(withPatch(explicacao, { followup: 'a'.repeat(501) })).map((e) => e.path),
      ).toEqual(['items[0].followup']);
    });

    test('explicação precisa ser aberta (recusa 18)', () => {
      expectOneError(
        withPatch(explicacao, {
          kind: 'multipla_escolha',
          options: ['a', 'b', 'c', 'd'],
          answer: 0,
        }),
        'items[0].kind',
        'precisa ser kind "aberta"',
      );
    });
  });

  describe('rubric (recusa 19)', () => {
    const rubric = explicacao.rubric;
    if (rubric === undefined) throw new Error('o exemplo de explicação precisa de rubric');

    test('com as 5 chaves valida', () => {
      expect(errorsOf(withPatch(explicacao, { rubric: clone(rubric) }))).toEqual([]);
    });

    test.each(['correcao', 'justificativa', 'coerencia', 'aplicacao', 'limitacoes'])(
      'recusa rubrica sem a chave %s',
      (chave) => {
        expect(
          errorsOf(withPatch(explicacao, { rubric: without(rubric, chave) })).map((e) => e.path),
        ).toEqual([`items[0].rubric.${chave}`]);
      },
    );

    test('recusa chave a mais', () => {
      expectOneError(
        withPatch(explicacao, { rubric: { ...rubric, estilo: 'x' } }),
        'items[0].rubric.estilo',
        'campo desconhecido',
      );
    });

    test('recusa texto vazio e texto com mais de 300 caracteres', () => {
      expect(
        errorsOf(withPatch(explicacao, { rubric: { ...rubric, correcao: '' } })).map((e) => e.path),
      ).toEqual(['items[0].rubric.correcao']);
      expect(
        errorsOf(withPatch(explicacao, { rubric: { ...rubric, correcao: 'a'.repeat(301) } })).map(
          (e) => e.path,
        ),
      ).toEqual(['items[0].rubric.correcao']);
      expect(
        errorsOf(withPatch(explicacao, { rubric: { ...rubric, correcao: 'a'.repeat(300) } })),
      ).toEqual([]);
    });
  });
});

describe('arquivo de notas da Jane', () => {
  const grade = at(exampleNotas.grades, 0);
  const withGrade = (patch: Record<string, unknown>) => ({
    ...clone(exampleNotas),
    grades: [{ ...grade, ...patch }],
  });

  test('o exemplo do doc valida e é reconhecido pelo type', () => {
    const result = parseImportFile(exampleNotas);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.file.type).toBe('notas_explicacao');
  });

  test('feedback é opcional', () => {
    expect(errorsOf({ ...clone(exampleNotas), grades: [without(grade, 'feedback')] })).toEqual([]);
  });

  test.each(['correcao', 'justificativa', 'coerencia', 'aplicacao', 'limitacoes'])(
    'recusa %s ausente',
    (chave) => {
      expect(
        errorsOf({ ...clone(exampleNotas), grades: [without(grade, chave)] }).map((e) => e.path),
      ).toEqual([`grades[0].${chave}`]);
    },
  );

  test.each([-1, 3, 1.5, '2', null])('recusa nota %j', (valor) => {
    expect(errorsOf(withGrade({ correcao: valor })).map((e) => e.path)).toEqual([
      'grades[0].correcao',
    ]);
  });

  test.each([0, 1, 2])('aceita nota %j', (valor) => {
    expect(errorsOf(withGrade({ aplicacao: valor }))).toEqual([]);
  });

  test('recusa feedback com mais de 1000 caracteres', () => {
    expect(errorsOf(withGrade({ feedback: 'a'.repeat(1001) })).map((e) => e.path)).toEqual([
      'grades[0].feedback',
    ]);
    expect(errorsOf(withGrade({ feedback: 'a'.repeat(1000) }))).toEqual([]);
  });

  test('recusa ID inválido em id e em review_log_id', () => {
    expect(errorsOf(withGrade({ id: 'x', review_log_id: 'y' })).map((e) => e.path)).toEqual([
      'grades[0].id',
      'grades[0].review_log_id',
    ]);
  });

  test('exige ao menos uma nota', () => {
    expect(errorsOf({ ...clone(exampleNotas), grades: [] }).map((e) => e.path)).toEqual(['grades']);
  });

  test('recusa version diferente de 1', () => {
    expectOneError({ ...clone(exampleNotas), version: 2 }, 'version', 'version deve ser 1');
  });

  test('o arquivo de notas não repete o texto do Márcio: campo extra é recusado', () => {
    expectOneError(
      withGrade({ response: 'texto do Márcio' }),
      'grades[0].response',
      'campo desconhecido',
    );
  });
});

describe('o campo type escolhe o tipo de arquivo', () => {
  test('type desconhecido é recusado', () => {
    expectOneError({ ...clone(exampleMinimo), type: 'conteudo2' }, 'type', 'type desconhecido');
  });

  test('o arquivo de pendentes é só leitura e não se importa', () => {
    expectOneError(
      {
        version: 1,
        type: 'explicacoes_pendentes',
        exported_at: '2026-12-02T21:00:00Z',
        pending: [],
      },
      'type',
      'type desconhecido',
    );
  });

  test('arquivo sem type é de conteúdo', () => {
    const result = parseImportFile(exampleMinimo);
    expect(result.ok && result.file.type).toBe('conteudo');
  });
});

describe('mensagens', () => {
  test('o caminho é legível e a mensagem vem em português', () => {
    const file = { ...exampleMinimo, skills: patchAt(exampleMinimo.skills, 1, { depth: 'dois' }) };
    const errors = errorsOf(file);
    expect(errors).toEqual([
      { path: 'skills[1].depth', message: expect.stringContaining('esperava') },
    ]);
  });

  test('vários erros saem todos de uma vez', () => {
    const file = clone(exampleMinimo);
    file.subject = { ...file.subject, color: 'azul', weight: 500 };
    expect(errorsOf(file).map((e) => e.path)).toEqual(['subject.color', 'subject.weight']);
  });
});
