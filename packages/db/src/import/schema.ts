import { z } from 'zod';

// Formato do JSON da importação (docs/09-schema-importacao.md). Este arquivo só
// confere o que cada registro diz sozinho: tipos, tamanhos e as combinações
// entre campos do mesmo registro. O que depende de outros registros ou do banco
// (ID repetido, quantidade de itens, pré-requisito, ciclo) fica em `check.ts` e
// na validação contra o banco.
//
// Falta, de propósito, o que é do ATL-136: `program` na raiz, `source.material`
// (nome ou link, ao lado de `material_id`) e `study` no Ofício. Quem os
// acrescentar mexe só nestes pontos, sem reescrever o resto.

// ID: 26 caracteres maiúsculos A–Z e 0–9. Não é o alfabeto estrito do ULID (sem
// I, L, O e U) porque o ID é só uma chave e os exemplos do doc, legíveis de
// propósito, não passariam nele.
export const ULID_PATTERN = /^[0-9A-Z]{26}$/;
export const ulidSchema = z
  .string()
  .regex(ULID_PATTERN, 'ID inválido: use 26 caracteres maiúsculos (A–Z e 0–9)');

export const DIMENSIONS = ['conceitual', 'fluencia', 'problemas', 'explicacao'] as const;
export const EVIDENCES = [
  'reconhecimento',
  'interpretacao',
  'representacao',
  'discriminacao',
] as const;
export const CATEGORIES = ['rotineira', 'nao_rotineira', 'transferencia'] as const;
export const ITEM_KINDS = ['multipla_escolha', 'cartao', 'aberta'] as const;
// "conceitual" e "autonomia" sempre se aplicam (D-043): não entram aqui.
export const NOT_APPLICABLE_DIMENSIONS = ['fluencia', 'problemas', 'explicacao'] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type Evidence = (typeof EVIDENCES)[number];
export type Category = (typeof CATEGORIES)[number];
export type ItemKind = (typeof ITEM_KINDS)[number];
export type NotApplicableDimension = (typeof NOT_APPLICABLE_DIMENSIONS)[number];

const page = z.int().min(1);

const subjectSchema = z.strictObject({
  id: ulidSchema,
  name: z.string().min(1).max(80),
  short_name: z.string().max(20).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'cor inválida: use o formato #rrggbb'),
  icon: z.string().min(1),
  weight: z.int().min(0).max(100).optional(),
  exam_at: z.iso.date({ error: 'exam_at deve ser uma data no formato AAAA-MM-DD' }).optional(),
});

const skillSourceSchema = z
  .strictObject({
    material_id: ulidSchema,
    page_from: page.optional(),
    page_to: page.optional(),
  })
  .refine((s) => s.page_from === undefined || s.page_to === undefined || s.page_from <= s.page_to, {
    error: 'page_from não pode ser maior que page_to',
    path: ['page_to'],
  });

const itemSourceSchema = z.strictObject({
  material_id: ulidSchema,
  page,
});

const notApplicableSchema = z
  .array(
    z.enum(NOT_APPLICABLE_DIMENSIONS, {
      error: (issue) =>
        issue.input === 'conceitual' || issue.input === 'autonomia'
          ? '"conceitual" e "autonomia" sempre se aplicam e não podem entrar em "not_applicable"'
          : 'dimensão desconhecida em "not_applicable": use fluencia, problemas ou explicacao',
    }),
  )
  .refine((values) => new Set(values).size === values.length, {
    error: '"not_applicable" não pode repetir valores',
  });

const skillSchema = z.strictObject({
  id: ulidSchema,
  name: z.string().min(1).max(80),
  label: z.string().max(24).optional(),
  description: z.string().max(300).optional(),
  icon: z.string().min(1),
  depth: z.int().min(1),
  lane: z.number().min(-1).max(1),
  estimated_minutes: z.int().min(10).max(40),
  prereqs: z.array(ulidSchema),
  origin: z.enum(['manual', 'ia']),
  reviewed_by_user: z.boolean(),
  source: skillSourceSchema.optional(),
  not_applicable: notApplicableSchema.optional(),
});

const rubricText = z.string().min(1).max(300);

// Exatamente estas 5 chaves, cada uma com o que vale nota 2 neste item (D-043).
const rubricSchema = z.strictObject({
  correcao: rubricText,
  justificativa: rubricText,
  coerencia: rubricText,
  aplicacao: rubricText,
  limitacoes: rubricText,
});

const itemObject = z.strictObject({
  id: ulidSchema,
  skill_id: ulidSchema,
  kind: z.enum(ITEM_KINDS),
  prompt: z.string().min(1).max(1000),
  options: z.array(z.string().min(1)).optional(),
  // Número (índice da alternativa) ou texto: qual dos dois vale depende do tipo
  // do item e é conferido em `checkItemFields`.
  answer: z.union([z.number(), z.string()]),
  explanation: z.string().min(20, 'explanation precisa ter ao menos 20 caracteres'),
  difficulty: z.int().min(1).max(3).optional(),
  dimension: z.enum(DIMENSIONS).optional(),
  evidence: z.enum(EVIDENCES).optional(),
  category: z.enum(CATEGORIES).optional(),
  expected_seconds: z.int().min(1).max(3600).optional(),
  followup: z.string().min(1).max(500).optional(),
  rubric: rubricSchema.optional(),
  tags: z.array(z.string()).optional(),
  origin: z.enum(['manual', 'ia']),
  reviewed_by_user: z.boolean(),
  source: itemSourceSchema.optional(),
  // `focus` virou `dimension` (D-057): arquivo antigo precisa ser regerado.
  focus: z
    .never({ error: 'o campo "focus" foi substituído por "dimension" (D-057): regere o arquivo' })
    .optional(),
});

type ItemFields = z.infer<typeof itemObject>;

// Combinações de campos do mesmo item (recusas 7, 10, 17 e 18 do docs/09).
function checkItemFields(item: ItemFields, ctx: z.RefinementCtx): void {
  const add = (field: string, message: string) =>
    ctx.addIssue({ code: 'custom', message, path: [field] });
  const { kind, options, answer, dimension } = item;

  if (kind === 'multipla_escolha' && options?.length !== 4) {
    add('options', 'múltipla escolha precisa de exatamente 4 alternativas em "options"');
  }
  if (kind === 'cartao' && options !== undefined && options.length !== 4) {
    add(
      'options',
      'cartão com "options" precisa de exatamente 4 alternativas (ou nenhuma, para cartão dissertativo)',
    );
  }
  if (kind === 'aberta' && options !== undefined) {
    add('options', 'questão aberta não pode ter "options"');
  }

  // Com alternativas (múltipla escolha e cartão de alternativas) o answer é o
  // índice da certa; sem elas (cartão dissertativo e aberta) é um texto.
  const hasChoices = kind === 'multipla_escolha' || (kind === 'cartao' && options !== undefined);
  if (hasChoices) {
    if (typeof answer !== 'number' || !Number.isInteger(answer) || answer < 0 || answer > 3) {
      add('answer', 'answer deve ser o número da alternativa certa (0 a 3)');
    }
  } else if (typeof answer !== 'string' || answer.length === 0) {
    add('answer', 'answer deve ser o texto da resposta');
  }

  if (kind === 'cartao' && dimension !== undefined) {
    add(
      'dimension',
      'cartão não tem "dimension": só exercício (múltipla escolha ou aberta) prova uma dimensão',
    );
  }

  // Cada campo existe só na dimensão que o usa, e a dimensão exige o dela.
  const only = (field: keyof ItemFields, owner: Dimension) => {
    if (item[field] !== undefined && dimension !== owner) {
      add(field, `"${field}" só vale com dimension "${owner}"`);
    }
  };
  const required = (field: keyof ItemFields, owner: Dimension) => {
    if (dimension === owner && item[field] === undefined) {
      add(field, `dimension "${owner}" exige "${field}"`);
    }
  };
  only('evidence', 'conceitual');
  required('evidence', 'conceitual');
  only('category', 'problemas');
  required('category', 'problemas');
  only('expected_seconds', 'fluencia');
  only('followup', 'explicacao');
  required('followup', 'explicacao');
  only('rubric', 'explicacao');
  required('rubric', 'explicacao');

  if (item.evidence === 'interpretacao' && kind !== 'multipla_escolha') {
    add('evidence', 'evidence "interpretacao" só vale em múltipla escolha');
  }
  if (dimension === 'explicacao' && kind !== 'aberta') {
    add('kind', 'item de explicação precisa ser kind "aberta"');
  }
}

const itemSchema = itemObject.superRefine(checkItemFields);

const isoDatetime = z.iso.datetime({
  error: 'deve ser data e hora ISO 8601 em UTC (ex.: 2026-11-16T09:00:00Z)',
});

const versionSchema = z.literal(1, { error: 'version deve ser 1' });

// Arquivo de conteúdo: o que a Jane gera (sem `type`).
export const contentFileSchema = z.strictObject({
  version: versionSchema,
  generated_at: isoDatetime,
  generated_by: z.string().min(1),
  subject: subjectSchema,
  skills: z.array(skillSchema),
  items: z.array(itemSchema),
});

const score = z.int().min(0).max(2);

const gradeSchema = z.strictObject({
  id: ulidSchema,
  review_log_id: ulidSchema,
  correcao: score,
  justificativa: score,
  coerencia: score,
  aplicacao: score,
  limitacoes: score,
  feedback: z.string().max(1000).optional(),
});

// Arquivo de notas da Jane para a Explicação (D-059). Não repete o texto do Márcio.
export const gradesFileSchema = z.strictObject({
  version: versionSchema,
  type: z.literal('notas_explicacao'),
  generated_at: isoDatetime,
  generated_by: z.string().min(1),
  grades: z.array(gradeSchema).min(1),
});

export type ContentFile = z.infer<typeof contentFileSchema>;
export type ContentSkill = ContentFile['skills'][number];
export type ContentItem = ContentFile['items'][number];
export type GradesFile = z.infer<typeof gradesFileSchema>;

export type ParsedImportFile =
  { type: 'conteudo'; data: ContentFile } | { type: 'notas_explicacao'; data: GradesFile };

export type ImportIssue = { path: string; message: string };

export type ParseResult =
  { ok: true; file: ParsedImportFile } | { ok: false; errors: ImportIssue[] };

// Mensagens em português sem mexer na configuração global do Zod.
const localeError = z.locales.pt().localeError;

// ["skills", 2, "prereqs", 0] -> "skills[2].prereqs[0]"
function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>((text, key) => {
    if (typeof key === 'number') return `${text}[${key}]`;
    return text === '' ? String(key) : `${text}.${String(key)}`;
  }, '');
}

function toIssues(error: z.ZodError): ImportIssue[] {
  return error.issues.flatMap((issue): ImportIssue[] => {
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        path: formatPath([...issue.path, key]),
        message: `campo desconhecido "${key}"`,
      }));
    }
    return [{ path: formatPath(issue.path), message: issue.message }];
  });
}

// Porta única para ler o JSON: o campo `type` escolhe o tipo de arquivo, e
// arquivo sem `type` é de conteúdo (docs/09).
export function parseImportFile(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, errors: [{ path: '', message: 'o arquivo precisa ser um objeto JSON' }] };
  }

  if ('type' in raw) {
    if (raw.type !== 'notas_explicacao') {
      const dica =
        raw.type === 'explicacoes_pendentes'
          ? ' (o arquivo de pendentes é só leitura para a Jane e não se importa)'
          : '';
      return {
        ok: false,
        errors: [
          {
            path: 'type',
            message: `type desconhecido (${JSON.stringify(raw.type)}): use "notas_explicacao" ou deixe sem type (arquivo de conteúdo)${dica}`,
          },
        ],
      };
    }
    const result = gradesFileSchema.safeParse(raw, { error: localeError });
    return result.success
      ? { ok: true, file: { type: 'notas_explicacao', data: result.data } }
      : { ok: false, errors: toIssues(result.error) };
  }

  const result = contentFileSchema.safeParse(raw, { error: localeError });
  return result.success
    ? { ok: true, file: { type: 'conteudo', data: result.data } }
    : { ok: false, errors: toIssues(result.error) };
}
