import { at, exampleMinimo, exampleProvas } from './fixtures';

// Geradores de arquivos de importação para os testes. Ficam em `src` pelo mesmo
// motivo das fixtures (o Dockerfile.test só copia `packages/db/src`, D-033).
// Devolvem objetos crus, como o JSON da Jane: quem testa passa por
// `parseImportFile` para validar.

// Gera um ID de 26 caracteres: 01JCXAM + zeros + prefixo + número (4 dígitos).
export function id(prefix: string, n: number): string {
  const tail = `${prefix}${String(n).padStart(4, '0')}`;
  return `01JCXAM${'0'.repeat(26 - 7 - tail.length)}${tail}`;
}

export const SKILL_A = id('SK', 1);
export const SKILL_B = id('SK', 2);

let counter = 0;
export function nextNumber(): number {
  counter += 1;
  return counter;
}

export type Raw = Record<string, unknown>;

export function rawSkill(n: number, patch: Raw = {}): Raw {
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

// Cartão dissertativo por padrão, no Ofício SK0001.
export function rawItem(patch: Raw = {}): Raw {
  const n = nextNumber();
  return {
    id: id('IT', n),
    skill_id: SKILL_A,
    kind: 'cartao',
    prompt: `Pergunta número ${n}`,
    answer: 'resposta',
    explanation: 'Explicação com mais de vinte caracteres.',
    origin: 'ia',
    reviewed_by_user: false,
    ...patch,
  };
}

export const rubric = at(exampleProvas.items, 5).rubric;

// Exercícios por dimensão (abertos, para a `evidence` "interpretacao" não
// atrapalhar). "interpretacao" só vale em múltipla escolha (recusa 18), então
// esse item é ME.
export const conceitual = (evidence: string, patch: Raw = {}): Raw =>
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
export const fluenciaItem = (patch: Raw = {}): Raw =>
  rawItem({ kind: 'aberta', dimension: 'fluencia', ...patch });
export const problema = (category: string, patch: Raw = {}): Raw =>
  rawItem({ kind: 'aberta', dimension: 'problemas', category, ...patch });
export const explicacaoItem = (patch: Raw = {}): Raw =>
  rawItem({ kind: 'aberta', dimension: 'explicacao', followup: 'E se...?', rubric, ...patch });
export const exercicio = (patch: Raw = {}): Raw => rawItem({ kind: 'aberta', ...patch });

export function times<T>(n: number, make: () => T): T[] {
  return Array.from({ length: n }, make);
}

// Itens que fecham todas as provas de um Ofício com folga: 1 de cada
// evidência, 12 de fluência, 8 problemas (3/3/2) e 1 explicação, mais 3 cartões.
export function fullItems(skillId: string = SKILL_A): Raw[] {
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
  ].map((item) => ({ ...item, skill_id: skillId }));
}

// Arquivo completo e importável: a matéria do exemplo mínimo com dois Ofícios
// (o segundo exige o primeiro) e itens que fecham as provas dos dois, sem
// recusa e sem aviso. O exemplo mínimo do docs/09 só passa no formato.
export function completeFile(patch: Raw = {}): Raw {
  return {
    ...exampleMinimo,
    skills: [rawSkill(1), rawSkill(2, { prereqs: [SKILL_A] })],
    items: [...fullItems(SKILL_A), ...fullItems(SKILL_B)],
    ...patch,
  };
}
