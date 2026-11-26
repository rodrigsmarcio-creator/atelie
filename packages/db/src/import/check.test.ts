import { describe, expect, test } from 'vitest';
import {
  checkContentFile,
  checkGradesFile,
  checkImportFile,
  type CheckResult,
  type ExistingItem,
} from './check';
import { at, exampleMinimo, exampleNotas, exampleProvas } from './fixtures';
import { parseImportFile, type ContentFile, type GradesFile } from './schema';

// Gera um ID de 26 caracteres: 01JCXAM + zeros + prefixo + número (4 dígitos).
function id(prefix: string, n: number): string {
  const tail = `${prefix}${String(n).padStart(4, '0')}`;
  return `01JCXAM${'0'.repeat(26 - 7 - tail.length)}${tail}`;
}

const SKILL_A = id('SK', 1);
const SKILL_B = id('SK', 2);

function rawSkill(n: number, patch: Record<string, unknown> = {}) {
  return {
    id: id('SK', n),
    name: `Ofício ${n}`,
    description: 'Descrição curta do Ofício.',
    icon: 'link',
    depth: n,
    lane: 0,
    estimated_minutes: 30,
    prereqs: [],
    origin: 'ia',
    reviewed_by_user: false,
    ...patch,
  };
}

let counter = 0;
function rawItem(patch: Record<string, unknown> = {}): Record<string, unknown> {
  counter += 1;
  return {
    id: id('IT', counter),
    skill_id: SKILL_A,
    kind: 'cartao',
    prompt: `Pergunta número ${counter}`,
    answer: 'resposta',
    explanation: 'Explicação com mais de vinte caracteres.',
    origin: 'ia',
    reviewed_by_user: false,
    ...patch,
  };
}

const rubric = at(exampleProvas.items, 5).rubric;

// Exercícios por dimensão (aberta, para a `evidence` "interpretacao" não atrapalhar).
// "interpretacao" só vale em múltipla escolha (recusa 18), então esse item é ME.
const conceitual = (evidence: string, patch = {}) =>
  evidence === 'interpretacao'
    ? rawItem({
        kind: 'multipla_escolha',
        options: ['a', 'b', 'c', 'd'],
        answer: 0,
        dimension: 'conceitual',
        evidence,
        ...patch,
      })
    : rawItem({ kind: 'aberta', dimension: 'conceitual', evidence, ...patch });
const fluenciaItem = (patch = {}) => rawItem({ kind: 'aberta', dimension: 'fluencia', ...patch });
const problema = (category: string, patch = {}) =>
  rawItem({ kind: 'aberta', dimension: 'problemas', category, ...patch });
const explicacaoItem = (patch = {}) =>
  rawItem({ kind: 'aberta', dimension: 'explicacao', followup: 'E se...?', rubric, ...patch });
const exercicio = (patch = {}) => rawItem({ kind: 'aberta', ...patch });

function times<T>(n: number, make: () => T): T[] {
  return Array.from({ length: n }, make);
}

// Itens que fecham todas as provas do Ofício SK0001 com folga: 1 de cada
// evidência, 12 de fluência, 8 problemas (3/3/2) e 1 explicação, mais 3 cartões.
function fullItems() {
  return [
    conceitual('reconhecimento'),
    conceitual('interpretacao'),
    conceitual('representacao'),
    conceitual('discriminacao'),
    ...times(12, () => fluenciaItem()),
    ...times(3, () => problema('rotineira')),
    ...times(3, () => problema('nao_rotineira')),
    ...times(2, () => problema('transferencia')),
    explicacaoItem(),
    ...times(3, () => rawItem()),
  ];
}

function content(
  skills: unknown[],
  items: unknown[],
  patch: Record<string, unknown> = {},
): ContentFile {
  const raw = {
    ...exampleMinimo,
    skills,
    items,
    ...patch,
  };
  const result = parseImportFile(raw);
  if (!result.ok || result.file.type !== 'conteudo') {
    throw new Error(`fixture inválida: ${JSON.stringify(result)}`);
  }
  return result.file.data;
}

function grades(list: unknown[]): GradesFile {
  const result = parseImportFile({ ...exampleNotas, grades: list });
  if (!result.ok || result.file.type !== 'notas_explicacao') throw new Error('fixture inválida');
  return result.file.data;
}

const messages = (issues: { message: string }[]) => issues.map((i) => i.message);
const paths = (issues: { path: string }[]) => issues.map((i) => i.path);

function existingItem(patch: Partial<ExistingItem> = {}): ExistingItem {
  counter += 1;
  return {
    id: id('DB', counter),
    skill_id: SKILL_A,
    kind: 'cartao',
    dimension: null,
    evidence: null,
    category: null,
    ...patch,
  };
}

describe('Ofício completo', () => {
  test('o conjunto de itens que fecha as provas não gera erro nem aviso', () => {
    const result = checkContentFile(content([rawSkill(1)], fullItems()));
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  test('o exemplo das provas do docs/09 não gera erro', () => {
    const provas = parseImportFile(exampleProvas);
    expect(provas.ok && checkImportFile(provas.file).errors).toEqual([]);
  });

  // O "exemplo mínimo" do doc passa no formato, mas o Ofício "Derivadas" não
  // tem item nenhum, e a regra 8 recusa Ofício com menos de 3 itens. Só o
  // formato do exemplo é garantido; o arquivo inteiro seria recusado.
  test('o exemplo mínimo do docs/09 só passa no formato: "Derivadas" não tem itens (regra 8)', () => {
    const minimo = parseImportFile(exampleMinimo);
    if (!minimo.ok) throw new Error('o formato do exemplo mínimo deveria valer');
    expect(checkImportFile(minimo.file).errors).toEqual([
      {
        path: 'skills[0]',
        message: 'Ofício "Derivadas" ficaria com 0 itens; o mínimo é 3',
      },
    ]);
  });
});

describe('ID repetido no arquivo (recusa 2)', () => {
  test('item com ID repetido aponta a segunda ocorrência e diz onde está a primeira', () => {
    const item = rawItem();
    const result = checkContentFile(content([rawSkill(1)], [...fullItems(), item, { ...item }]));
    const dup = result.errors.filter((e) => e.message.includes('ID repetido'));
    expect(dup).toHaveLength(1);
    expect(dup[0]?.path).toBe(`items[${fullItems().length + 1}].id`);
    expect(dup[0]?.message).toContain(`items[${fullItems().length}].id`);
  });

  test('Ofício com ID repetido', () => {
    const result = checkContentFile(
      content([rawSkill(1), rawSkill(2, { id: SKILL_A, name: 'Outro' })], []),
    );
    expect(result.errors.map((e) => e.path)).toContain('skills[1].id');
  });

  test('o ID da matéria também não pode se repetir em Ofício ou item', () => {
    const subjectId = exampleMinimo.subject.id;
    const result = checkContentFile(content([rawSkill(1, { id: subjectId })], fullItems()));
    expect(result.errors.map((e) => e.path)).toContain('skills[0].id');
  });

  test('IDs diferentes não geram erro', () => {
    const result = checkContentFile(content([rawSkill(1), rawSkill(2)], []));
    expect(result.errors.filter((e) => e.message.includes('ID repetido'))).toEqual([]);
  });
});

describe('nome de Ofício repetido na matéria', () => {
  test('o segundo nome igual é erro', () => {
    const result = checkContentFile(content([rawSkill(1), rawSkill(2, { name: 'Ofício 1' })], []));
    expect(result.errors).toContainEqual({
      path: 'skills[1].name',
      message: expect.stringContaining('nome de Ofício repetido'),
    });
  });
});

describe('quantidade de itens por Ofício (recusa 8, D-058)', () => {
  const cards = (n: number) => times(n, () => rawItem());
  const run = (n: number, existing: ExistingItem[] = []) =>
    checkContentFile(content([rawSkill(1)], cards(n)), { items: existing });

  test.each([0, 1, 2])('%i itens: erro', (n) => {
    const result = run(n);
    expect(result.errors).toContainEqual({
      path: 'skills[0]',
      message: expect.stringContaining(`ficaria com ${n} ite`),
    });
  });

  test.each([3, 7])('%i itens: aviso, sem erro', (n) => {
    const result = run(n);
    expect(result.errors).toEqual([]);
    expect(messages(result.warnings).join('\n')).toContain('poucos');
  });

  test.each([8, 40])('%i itens: sem aviso de quantidade', (n) => {
    const result = run(n);
    expect(result.errors).toEqual([]);
    expect(messages(result.warnings).join('\n')).not.toMatch(/poucos|muitos/);
  });

  test.each([41, 60])('%i itens: aviso, sem erro', (n) => {
    const result = run(n);
    expect(result.errors).toEqual([]);
    expect(messages(result.warnings).join('\n')).toContain('muitos');
  });

  test('61 itens: erro', () => {
    expect(messages(run(61).errors).join('\n')).toContain('ficaria com 61 ite');
  });

  test('conta também os itens que já estão no banco', () => {
    // 2 no arquivo + 1 no banco = 3: não é erro.
    const result = checkContentFile(content([rawSkill(1)], cards(2)), { items: [existingItem()] });
    expect(result.errors).toEqual([]);
  });

  test('item do banco que o arquivo reimporta (mesmo ID) não conta duas vezes', () => {
    const items = cards(2);
    const velho = existingItem({ id: String(at(items, 0).id) });
    const result = checkContentFile(content([rawSkill(1)], items), { items: [velho] });
    expect(messages(result.errors).join('\n')).toContain('ficaria com 2 ite');
  });

  test('itens de um Ofício que só existe no banco também são contados', () => {
    const items = [rawItem({ skill_id: SKILL_B })];
    const semBanco = checkContentFile(content([], items));
    expect(semBanco.errors).toContainEqual({
      path: 'items',
      message: expect.stringContaining(SKILL_B),
    });
    const noBanco = times(30, () => existingItem({ skill_id: SKILL_B }));
    expect(checkContentFile(content([], items), { items: noBanco }).errors).toEqual([]);
  });
});

describe('origin "manual" em arquivo da Jane (recusa 9)', () => {
  test('em Ofício e em item', () => {
    const items = [...fullItems(), rawItem({ origin: 'manual' })];
    const result = checkContentFile(content([rawSkill(1, { origin: 'manual' })], items));
    expect(paths(result.errors)).toEqual(['skills[0].origin', `items[${items.length - 1}].origin`]);
    expect(messages(result.errors)[0]).toContain('gerado pela Jane');
  });

  test('vale quando generated_by não é da Jane', () => {
    const file = content([rawSkill(1, { origin: 'manual' })], fullItems(), {
      generated_by: 'manual/Márcio',
    });
    expect(checkContentFile(file).errors).toEqual([]);
  });

  test('origin "ia" é sempre aceita', () => {
    expect(checkContentFile(content([rawSkill(1)], fullItems())).errors).toEqual([]);
  });
});

describe('avisos que só olham o arquivo', () => {
  test('Ofício sem description', () => {
    const semDescricao = { ...rawSkill(1), description: undefined };
    const result = checkContentFile(content([semDescricao], fullItems()));
    expect(result.warnings).toContainEqual({
      path: 'skills[0].description',
      message: expect.stringContaining('sem description'),
    });
  });

  test('lane repetido no mesmo depth', () => {
    const skills = [rawSkill(1, { depth: 1, lane: 0.5 }), rawSkill(2, { depth: 1, lane: 0.5 })];
    const result = checkContentFile(content(skills, []));
    expect(result.warnings).toContainEqual({
      path: 'skills[1].lane',
      message: expect.stringContaining('vão se sobrepor'),
    });
  });

  test('lane igual em depth diferente não avisa', () => {
    const skills = [rawSkill(1, { depth: 1, lane: 0.5 }), rawSkill(2, { depth: 2, lane: 0.5 })];
    const result = checkContentFile(content(skills, []));
    expect(messages(result.warnings).join('\n')).not.toContain('vão se sobrepor');
  });

  test('prompt igual ao de outro item', () => {
    const items = [
      ...fullItems(),
      rawItem({ prompt: 'Pergunta repetida' }),
      rawItem({ prompt: 'Pergunta repetida' }),
    ];
    const result = checkContentFile(content([rawSkill(1)], items));
    expect(result.warnings).toContainEqual({
      path: `items[${items.length - 1}].prompt`,
      message: expect.stringContaining(`items[${items.length - 2}]`),
    });
  });
});

describe('mínimos por Ofício (D-058)', () => {
  const without = (drop: (item: Record<string, unknown>) => boolean) =>
    fullItems().filter((item) => !drop(item));
  const warningsOf = (items: unknown[], skillPatch: Record<string, unknown> = {}) =>
    messages(checkContentFile(content([rawSkill(1, skillPatch)], items)).warnings).join('\n');

  test('Autonomia: só cartões não fecham', () => {
    const cartoes = times(8, () => rawItem());
    expect(warningsOf(cartoes)).toContain('Autonomia: falta 1 exercício');
  });

  test('Autonomia: um exercício sem dimension basta', () => {
    const items = [exercicio(), ...times(7, () => rawItem())];
    expect(warningsOf(items)).not.toContain('Autonomia');
  });

  test('Compreensão conceitual: diz quais evidências faltam', () => {
    const items = without((i) => i.evidence === 'representacao' || i.evidence === 'discriminacao');
    const texto = warningsOf(items);
    expect(texto).toContain('Compreensão conceitual');
    expect(texto).toContain('representacao, discriminacao');
    expect(texto).not.toContain('reconhecimento,');
  });

  test('Fluência: 11 de 12 diz quantos faltam', () => {
    const items = without((i) => i.dimension === 'fluencia').concat(
      times(11, () => fluenciaItem()),
      [rawItem(), rawItem()],
    );
    expect(warningsOf(items)).toContain('Fluência: faltam 1 de 12');
  });

  test('Resolução de problemas: diz o que falta de cada categoria', () => {
    const items = without((i) => i.category === 'transferencia');
    expect(warningsOf(items)).toContain('Resolução de problemas: falta 1 de transferencia');
    const poucos = without((i) => i.dimension === 'problemas').concat(
      problema('rotineira'),
      problema('nao_rotineira'),
      problema('nao_rotineira'),
      problema('transferencia'),
    );
    expect(warningsOf(poucos)).toContain('falta 1 de rotineira');
  });

  test('Resolução de problemas: 5 problemas (2/2/1) fecham, mas avisam da folga', () => {
    const items = without((i) => i.dimension === 'problemas').concat(
      times(2, () => problema('rotineira')),
      times(2, () => problema('nao_rotineira')),
      [problema('transferencia')],
    );
    const texto = warningsOf(items);
    expect(texto).toContain('5 problemas fecham a dimensão, mas sem folga');
    expect(texto).not.toContain('falta');
  });

  test('Resolução de problemas: 8 problemas não avisam', () => {
    expect(warningsOf(fullItems())).toBe('');
  });

  test('Explicação: falta o item com pergunta complementar e rubrica', () => {
    const items = without((i) => i.dimension === 'explicacao');
    expect(warningsOf(items)).toContain('Explicação: falta 1 item');
  });

  test('o aviso aponta o Ofício e traz o nome dele', () => {
    const items = without((i) => i.dimension === 'explicacao');
    const result = checkContentFile(content([rawSkill(1)], items));
    expect(result.warnings[0]).toEqual({
      path: 'skills[0]',
      message: expect.stringContaining('Ofício "Ofício 1"'),
    });
  });

  test('o item do banco conta para o mínimo', () => {
    const items = without((i) => i.dimension === 'explicacao');
    const noBanco = [existingItem({ kind: 'aberta', dimension: 'explicacao' })];
    const result = checkContentFile(content([rawSkill(1)], items), { items: noBanco });
    expect(result.warnings).toEqual([]);
  });
});

describe('dimensão "não se aplica"', () => {
  const semFluencia = () =>
    fullItems()
      .filter((i) => i.dimension !== 'fluencia')
      .concat(times(3, () => rawItem()));

  test('não é conferida: sem item de fluência não há aviso', () => {
    const result = checkContentFile(
      content([rawSkill(1, { not_applicable: ['fluencia'] })], semFluencia()),
    );
    expect(result.warnings).toEqual([]);
  });

  test('sem a marcação, a dimensão falta e avisa', () => {
    const result = checkContentFile(content([rawSkill(1)], semFluencia()));
    expect(messages(result.warnings).join('\n')).toContain('Fluência: faltam 12 de 12');
  });

  test('marcar e ainda ter itens dela avisa que não contam', () => {
    const result = checkContentFile(
      content([rawSkill(1, { not_applicable: ['fluencia'] })], fullItems()),
    );
    expect(result.warnings).toContainEqual({
      path: 'skills[0]',
      message: expect.stringContaining('marca "fluencia" como não se aplica, mas tem 12 itens'),
    });
  });

  test('not_applicable ausente mantém o que o Ofício já tinha no banco', () => {
    const result = checkContentFile(content([rawSkill(1)], semFluencia()), {
      skills: [{ id: SKILL_A, not_applicable: ['fluencia'] }],
    });
    expect(result.warnings).toEqual([]);
  });

  test('not_applicable do arquivo vale mais que o do banco', () => {
    const result = checkContentFile(content([rawSkill(1, { not_applicable: [] })], semFluencia()), {
      skills: [{ id: SKILL_A, not_applicable: ['fluencia'] }],
    });
    expect(messages(result.warnings).join('\n')).toContain('Fluência: faltam 12 de 12');
  });
});

describe('arquivo de notas: ID repetido (recusa 2)', () => {
  const grade = exampleNotas.grades[0];

  test('sem repetição não há erro nem aviso', () => {
    expect(checkGradesFile(grades([grade]))).toEqual({ errors: [], warnings: [] });
  });

  test('id repetido', () => {
    const result = checkGradesFile(grades([grade, { ...grade, review_log_id: id('LG', 2) }]));
    expect(result.errors).toContainEqual({
      path: 'grades[1].id',
      message: expect.stringContaining('ID repetido'),
    });
  });

  test('review_log_id repetido: uma nota por tentativa', () => {
    const result = checkGradesFile(grades([grade, { ...grade, id: id('GR', 2) }]));
    expect(result.errors).toContainEqual({
      path: 'grades[1].review_log_id',
      message: expect.stringContaining('review_log_id repetido'),
    });
  });
});

describe('checkImportFile escolhe a conferência pelo tipo', () => {
  test('conteúdo e notas', () => {
    const conteudo = parseImportFile(exampleProvas);
    const notas = parseImportFile(exampleNotas);
    if (!conteudo.ok || !notas.ok) throw new Error('fixture inválida');
    const a: CheckResult = checkImportFile(conteudo.file);
    const b: CheckResult = checkImportFile(notas.file);
    expect(a.errors).toEqual([]);
    expect(a.warnings.length).toBeGreaterThan(0); // exemplo curto: faltam itens para fechar as provas
    expect(b).toEqual({ errors: [], warnings: [] });
  });
});
