import {
  CATEGORIES,
  EVIDENCES,
  NOT_APPLICABLE_DIMENSIONS,
  type Category,
  type ContentFile,
  type Dimension,
  type Evidence,
  type GradesFile,
  type ItemKind,
  type NotApplicableDimension,
  type ParsedImportFile,
} from './schema';

// Conferência do arquivo inteiro, sem banco: o que depende de vários registros
// (ID repetido, quantidade de itens, origin contra generated_by) e os avisos
// (docs/09-schema-importacao.md). O que o banco precisa dizer (quantos itens o
// Ofício já tem, o `not_applicable` dele) entra pelo parâmetro `existing`, que
// a importação preenche; sem ele, conta só o arquivo. Pré-requisito, ciclo e
// `depth` ficam na validação contra o banco.

export type CheckIssue = { path: string; message: string };
export type CheckResult = { errors: CheckIssue[]; warnings: CheckIssue[] };

// Item já gravado (não arquivado). O arquivo que traz o mesmo `id` o substitui.
export type ExistingItem = {
  id: string;
  skill_id: string;
  kind: ItemKind;
  dimension: Dimension | null;
  evidence: Evidence | null;
  category: Category | null;
};

export type ExistingSkill = { id: string; not_applicable: readonly NotApplicableDimension[] };

export type ExistingContext = {
  items?: readonly ExistingItem[];
  skills?: readonly ExistingSkill[];
};

// Limites e mínimos por Ofício: hipótese (D-058), a rever com a primeira rodada
// de conteúdo real (A-013).
const ITEMS_PER_SKILL = {
  min: 3, // abaixo disto, erro
  comfortableFrom: 8, // de min a aqui, aviso
  comfortableUntil: 40, // daqui até max, aviso
  max: 60, // acima disto, erro
} as const;

const MINIMUMS = {
  fluencia: 12,
  problemas: { rotineira: 2, nao_rotineira: 2, transferencia: 1 } satisfies Record<
    Category,
    number
  >,
  // Com 5 problemas a rodada fecha, mas quem reprova gasta os 5 (D-058).
  problemasComFolga: 8,
} as const;

// `generated_by` que começa assim é da Jane, e a Jane nunca escreve "manual".
const JANE_GENERATED_BY_PREFIX = 'claude-code/';

const itens = (n: number) => `${n} ${n === 1 ? 'item' : 'itens'}`;

function checkDuplicateIds(file: ContentFile, errors: CheckIssue[]): void {
  const seen = new Map<string, string>();
  const visit = (path: string, value: string) => {
    const first = seen.get(value);
    if (first === undefined) seen.set(value, path);
    else errors.push({ path, message: `ID repetido no arquivo: já usado em ${first}` });
  };
  visit('subject.id', file.subject.id);
  file.skills.forEach((skill, i) => visit(`skills[${i}].id`, skill.id));
  file.items.forEach((item, i) => visit(`items[${i}].id`, item.id));
}

// O nome é único dentro da matéria (docs/09), e o banco tem UNIQUE para isso.
function checkDuplicateSkillNames(file: ContentFile, errors: CheckIssue[]): void {
  const seen = new Map<string, number>();
  file.skills.forEach((skill, i) => {
    const first = seen.get(skill.name);
    if (first === undefined) seen.set(skill.name, i);
    else {
      errors.push({
        path: `skills[${i}].name`,
        message: `nome de Ofício repetido na matéria: "${skill.name}" (já em skills[${first}])`,
      });
    }
  });
}

function checkOriginAgainstGeneratedBy(file: ContentFile, errors: CheckIssue[]): void {
  if (!file.generated_by.startsWith(JANE_GENERATED_BY_PREFIX)) return;
  const message = `origin "manual" não vale em arquivo gerado pela Jane (generated_by "${file.generated_by}")`;
  file.skills.forEach((skill, i) => {
    if (skill.origin === 'manual') errors.push({ path: `skills[${i}].origin`, message });
  });
  file.items.forEach((item, i) => {
    if (item.origin === 'manual') errors.push({ path: `items[${i}].origin`, message });
  });
}

function checkSkillWarnings(file: ContentFile, warnings: CheckIssue[]): void {
  const lanes = new Map<string, number>();
  file.skills.forEach((skill, i) => {
    if (skill.description === undefined) {
      warnings.push({
        path: `skills[${i}].description`,
        message: `Ofício "${skill.name}" sem description`,
      });
    }
    const key = `${skill.depth}|${skill.lane}`;
    const first = lanes.get(key);
    if (first === undefined) lanes.set(key, i);
    else {
      warnings.push({
        path: `skills[${i}].lane`,
        message: `lane ${skill.lane} repetido no depth ${skill.depth} (como em skills[${first}]): os Ofícios vão se sobrepor na Árvore`,
      });
    }
  });
}

function checkRepeatedPrompts(file: ContentFile, warnings: CheckIssue[]): void {
  const seen = new Map<string, number>();
  file.items.forEach((item, i) => {
    const first = seen.get(item.prompt);
    if (first === undefined) seen.set(item.prompt, i);
    else
      warnings.push({ path: `items[${i}].prompt`, message: `prompt igual ao de items[${first}]` });
  });
}

type CountedItem = {
  kind: ItemKind;
  dimension: Dimension | null;
  evidence: Evidence | null;
  category: Category | null;
};

// O que um Ofício terá depois da importação: itens do arquivo mais os do banco,
// sem os que o arquivo reimporta (o upsert os substitui).
function itemsAfterImport(file: ContentFile, existing: ExistingContext, skillId: string) {
  const fileIds = new Set(file.items.map((item) => item.id));
  const fromFile: CountedItem[] = file.items
    .filter((item) => item.skill_id === skillId)
    .map((item) => ({
      kind: item.kind,
      dimension: item.dimension ?? null,
      evidence: item.evidence ?? null,
      category: item.category ?? null,
    }));
  const fromDb: CountedItem[] = (existing.items ?? []).filter(
    (item) => item.skill_id === skillId && !fileIds.has(item.id),
  );
  return [...fromFile, ...fromDb];
}

// Lacunas que impedem o Ofício de fechar alguma dimensão (D-058).
function dimensionGaps(
  items: readonly CountedItem[],
  notApplicable: readonly NotApplicableDimension[],
): { gaps: string[]; folga: string | null } {
  const gaps: string[] = [];
  const count = (dimension: Dimension) => items.filter((i) => i.dimension === dimension).length;

  if (items.every((i) => i.kind === 'cartao')) {
    gaps.push('Autonomia: falta 1 exercício (múltipla escolha ou aberta)');
  }

  const missingEvidences = EVIDENCES.filter(
    (evidence) => !items.some((i) => i.dimension === 'conceitual' && i.evidence === evidence),
  );
  if (missingEvidences.length > 0) {
    gaps.push(
      `Compreensão conceitual: falta exercício de evidência ${missingEvidences.join(', ')}`,
    );
  }

  if (!notApplicable.includes('fluencia') && count('fluencia') < MINIMUMS.fluencia) {
    gaps.push(
      `Fluência: faltam ${MINIMUMS.fluencia - count('fluencia')} de ${MINIMUMS.fluencia} exercícios`,
    );
  }

  let folga: string | null = null;
  if (!notApplicable.includes('problemas')) {
    const missing = CATEGORIES.map((category) => ({
      category,
      falta:
        MINIMUMS.problemas[category] -
        items.filter((i) => i.dimension === 'problemas' && i.category === category).length,
    })).filter((m) => m.falta > 0);
    if (missing.length > 0) {
      gaps.push(
        `Resolução de problemas: ${missing.map((m) => `falta ${m.falta} de ${m.category}`).join('; ')}`,
      );
    } else if (count('problemas') < MINIMUMS.problemasComFolga) {
      folga = `Resolução de problemas: ${count('problemas')} problemas fecham a dimensão, mas sem folga para nova rodada (o ideal é ${MINIMUMS.problemasComFolga} ou mais)`;
    }
  }

  if (!notApplicable.includes('explicacao') && count('explicacao') < 1) {
    gaps.push('Explicação: falta 1 item com pergunta complementar e rubrica');
  }

  return { gaps, folga };
}

function checkSkills(
  file: ContentFile,
  existing: ExistingContext,
  errors: CheckIssue[],
  warnings: CheckIssue[],
): void {
  // Os Ofícios do arquivo e os que só recebem itens (já existem no banco).
  const skillIds = [
    ...file.skills.map((s) => s.id),
    ...file.items.map((i) => i.skill_id).filter((id) => !file.skills.some((s) => s.id === id)),
  ].filter((id, index, all) => all.indexOf(id) === index);

  for (const skillId of skillIds) {
    const index = file.skills.findIndex((s) => s.id === skillId);
    const skill = index >= 0 ? file.skills[index] : undefined;
    const label = skill?.name ?? skillId;
    const path = skill ? `skills[${index}]` : 'items';
    const items = itemsAfterImport(file, existing, skillId);
    const n = items.length;

    if (n < ITEMS_PER_SKILL.min) {
      errors.push({
        path,
        message: `Ofício "${label}" ficaria com ${itens(n)}; o mínimo é ${ITEMS_PER_SKILL.min}`,
      });
    } else if (n > ITEMS_PER_SKILL.max) {
      errors.push({
        path,
        message: `Ofício "${label}" ficaria com ${itens(n)}; o máximo é ${ITEMS_PER_SKILL.max}`,
      });
    } else if (n < ITEMS_PER_SKILL.comfortableFrom) {
      warnings.push({
        path,
        message: `Ofício "${label}" tem ${itens(n)}: poucos para fechar as provas (o ideal é a partir de ${ITEMS_PER_SKILL.comfortableFrom})`,
      });
    } else if (n > ITEMS_PER_SKILL.comfortableUntil) {
      warnings.push({
        path,
        message: `Ofício "${label}" tem ${itens(n)}: muitos (o ideal é até ${ITEMS_PER_SKILL.comfortableUntil})`,
      });
    }

    // `not_applicable` ausente no arquivo mantém o que o Ofício já tinha.
    const notApplicable =
      skill?.not_applicable ?? existing.skills?.find((s) => s.id === skillId)?.not_applicable ?? [];

    const { gaps, folga } = dimensionGaps(items, notApplicable);
    for (const gap of gaps) {
      warnings.push({
        path,
        message: `Ofício "${label}": ${gap} (sem isso o Ofício não chega a Dominado)`,
      });
    }
    if (folga !== null) warnings.push({ path, message: `Ofício "${label}": ${folga}` });

    for (const dimension of NOT_APPLICABLE_DIMENSIONS) {
      const marked = items.filter((i) => i.dimension === dimension).length;
      if (notApplicable.includes(dimension) && marked > 0) {
        warnings.push({
          path,
          message: `Ofício "${label}" marca "${dimension}" como não se aplica, mas tem ${itens(marked)} dela (ficam, mas não contam)`,
        });
      }
    }
  }
}

export function checkContentFile(file: ContentFile, existing: ExistingContext = {}): CheckResult {
  const errors: CheckIssue[] = [];
  const warnings: CheckIssue[] = [];
  checkDuplicateIds(file, errors);
  checkDuplicateSkillNames(file, errors);
  checkOriginAgainstGeneratedBy(file, errors);
  checkSkillWarnings(file, warnings);
  checkRepeatedPrompts(file, warnings);
  checkSkills(file, existing, errors, warnings);
  return { errors, warnings };
}

// Arquivo de notas: o ID da nota e a tentativa avaliada não se repetem (uma
// nota por tentativa, D-057). O resto depende do banco.
export function checkGradesFile(file: GradesFile): CheckResult {
  const errors: CheckIssue[] = [];
  const ids = new Map<string, number>();
  const logs = new Map<string, number>();
  file.grades.forEach((grade, i) => {
    const firstId = ids.get(grade.id);
    if (firstId === undefined) ids.set(grade.id, i);
    else {
      errors.push({
        path: `grades[${i}].id`,
        message: `ID repetido no arquivo: já usado em grades[${firstId}].id`,
      });
    }
    const firstLog = logs.get(grade.review_log_id);
    if (firstLog === undefined) logs.set(grade.review_log_id, i);
    else {
      errors.push({
        path: `grades[${i}].review_log_id`,
        message: `review_log_id repetido no arquivo: a nota é uma por tentativa (já em grades[${firstLog}])`,
      });
    }
  });
  return { errors, warnings: [] };
}

export function checkImportFile(
  file: ParsedImportFile,
  existing: ExistingContext = {},
): CheckResult {
  return file.type === 'conteudo'
    ? checkContentFile(file.data, existing)
    : checkGradesFile(file.data);
}
