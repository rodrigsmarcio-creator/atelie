import { inArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client';
import { imports, items, materialSkills, skillPrereqs, skills, subjects } from '../schema';
import type { CheckIssue } from './check';
import { newId } from './ids';
import type { ContentFile, ParsedImportFile } from './schema';
import { loadImportState } from './state';
import { validateContent } from './validate';

// Grava o arquivo de conteúdo (docs/09-schema-importacao.md, "Idempotência"):
// upsert por ID, tudo ou nada. O arquivo é conferido contra o banco antes; se
// tiver erro, nada é gravado.

export type RunContext = {
  fileName: string;
  // SHA-256 do arquivo, calculado por quem lê o arquivo (o comando).
  fileHash: string;
  // "Agora" e o gerador de ID entram por parâmetro para o teste ser determinístico.
  now?: string;
  newId?: () => string;
};

export type RunSummary = {
  importId: string;
  subject: { name: string; created: boolean };
  skills: { inserted: number; existing: number };
  items: { inserted: number; existing: number };
  warnings: CheckIssue[];
};

export type RunResult =
  { ok: true; summary: RunSummary } | { ok: false; errors: CheckIssue[]; warnings: CheckIssue[] };

// Só os campos que o arquivo trouxe: o resto fica como está no banco ("campo
// opcional omitido não apaga", docs/09).
function defined<T extends Record<string, unknown>>(
  values: T,
): { [K in keyof T]?: Exclude<T[K], undefined> } {
  // O filtro tira os `undefined`; o Object.fromEntries só não sabe disso no tipo.
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as {
    [K in keyof T]?: Exclude<T[K], undefined>;
  };
}

// `reviewed_by_user` nunca volta de true para false: o arquivo da Jane sempre
// diz false, e a revisão do Márcio vale mais.
const keepReviewed = (column: typeof skills.reviewedByUser | typeof items.reviewedByUser) =>
  sql`max(${column}, excluded.reviewed_by_user)`;

type Batch = [BatchItem<'sqlite'>, ...BatchItem<'sqlite'>[]];

function buildStatements(db: Db, file: ContentFile, now: string, importRow: ImportRow): Batch {
  const { subject } = file;
  const batch: Batch = [
    db
      .insert(subjects)
      .values({
        id: subject.id,
        name: subject.name,
        shortName: subject.short_name ?? null,
        color: subject.color,
        icon: subject.icon,
        weight: subject.weight ?? 0,
        examAt: subject.exam_at ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: subjects.id,
        set: {
          name: subject.name,
          color: subject.color,
          icon: subject.icon,
          updatedAt: now,
          ...defined({
            shortName: subject.short_name,
            weight: subject.weight,
            examAt: subject.exam_at,
          }),
        },
      }),
  ];

  for (const skill of file.skills) {
    batch.push(
      db
        .insert(skills)
        .values({
          id: skill.id,
          subjectId: subject.id,
          name: skill.name,
          label: skill.label ?? null,
          description: skill.description ?? null,
          icon: skill.icon,
          depth: skill.depth,
          lane: skill.lane,
          estimatedMinutes: skill.estimated_minutes,
          origin: skill.origin,
          reviewedByUser: skill.reviewed_by_user,
          sourceMaterialId: skill.source?.material_id ?? null,
          notApplicableJson: skill.not_applicable ?? [],
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: skills.id,
          set: {
            name: skill.name,
            icon: skill.icon,
            depth: skill.depth,
            lane: skill.lane,
            estimatedMinutes: skill.estimated_minutes,
            reviewedByUser: keepReviewed(skills.reviewedByUser),
            updatedAt: now,
            ...defined({
              label: skill.label,
              description: skill.description,
              sourceMaterialId: skill.source?.material_id,
              notApplicableJson: skill.not_applicable,
            }),
          },
        }),
    );
    if (skill.source !== undefined) {
      const pages = defined({ pageFrom: skill.source.page_from, pageTo: skill.source.page_to });
      const insert = db.insert(materialSkills).values({
        materialId: skill.source.material_id,
        skillId: skill.id,
        pageFrom: skill.source.page_from ?? null,
        pageTo: skill.source.page_to ?? null,
        createdAt: now,
      });
      batch.push(
        Object.keys(pages).length > 0
          ? insert.onConflictDoUpdate({
              target: [materialSkills.materialId, materialSkills.skillId],
              set: pages,
            })
          : insert.onConflictDoNothing(),
      );
    }
  }

  // Os pré-requisitos do arquivo substituem os dos Ofícios que ele traz.
  if (file.skills.length > 0) {
    batch.push(
      db.delete(skillPrereqs).where(
        inArray(
          skillPrereqs.skillId,
          file.skills.map((skill) => skill.id),
        ),
      ),
    );
  }
  const edges = file.skills.flatMap((skill) =>
    skill.prereqs.map((prereqId) => ({ skillId: skill.id, prereqId, createdAt: now })),
  );
  if (edges.length > 0) batch.push(db.insert(skillPrereqs).values(edges));

  for (const item of file.items) {
    // Nos campos das provas o item do arquivo é a verdade inteira: ausente vira nulo.
    const exam = {
      dimension: item.dimension ?? null,
      evidence: item.evidence ?? null,
      category: item.category ?? null,
      expectedSeconds: item.expected_seconds ?? null,
      followup: item.followup ?? null,
      rubricJson: item.rubric ?? null,
    };
    batch.push(
      db
        .insert(items)
        .values({
          id: item.id,
          skillId: item.skill_id,
          kind: item.kind,
          prompt: item.prompt,
          optionsJson: item.options ?? null,
          // O índice da alternativa certa (0 a 3) é guardado como texto (docs/04).
          answer: String(item.answer),
          explanation: item.explanation,
          difficulty: item.difficulty ?? null,
          ...exam,
          origin: item.origin,
          reviewedByUser: item.reviewed_by_user,
          sourceMaterialId: item.source?.material_id ?? null,
          sourcePage: item.source?.page ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: items.id,
          set: {
            kind: item.kind,
            prompt: item.prompt,
            optionsJson: item.options ?? null,
            answer: String(item.answer),
            explanation: item.explanation,
            ...exam,
            reviewedByUser: keepReviewed(items.reviewedByUser),
            updatedAt: now,
            ...defined({
              difficulty: item.difficulty,
              sourceMaterialId: item.source?.material_id,
              sourcePage: item.source?.page,
            }),
          },
        }),
    );
  }

  batch.push(db.insert(imports).values(importRow));
  return batch;
}

type ImportRow = typeof imports.$inferInsert;

export async function runImport(
  db: Db,
  file: ParsedImportFile,
  context: RunContext,
): Promise<RunResult> {
  if (file.type === 'notas_explicacao') {
    return {
      ok: false,
      errors: [{ path: '', message: 'importação de notas ainda não implementada' }],
      warnings: [],
    };
  }

  const content = file.data;
  const state = await loadImportState(db, content);
  const validation = validateContent(content, state);
  if (validation.errors.length > 0) {
    return { ok: false, errors: validation.errors, warnings: validation.warnings };
  }

  const now = context.now ?? new Date().toISOString();
  const importId = (context.newId ?? newId)();
  const skillsExisting = content.skills.filter((skill) => state.skills.has(skill.id)).length;
  const itemsExisting = content.items.filter((item) => state.itemOwners.has(item.id)).length;
  const skillsInserted = content.skills.length - skillsExisting;
  const itemsInserted = content.items.length - itemsExisting;

  // Um lote só: o libsql roda tudo numa transação e desfaz tudo se um comando
  // falhar. As leituras acima já conferiram o arquivo; a transação é só para a
  // gravação (um único usuário, sem outra importação ao mesmo tempo).
  await db.batch(
    buildStatements(db, content, now, {
      id: importId,
      kind: 'conteudo',
      fileName: context.fileName,
      fileHash: context.fileHash,
      ranAt: now,
      skillsInserted,
      itemsInserted,
      gradesInserted: 0,
      // "Pulados" são os que já existiam, atualizados ou idênticos (D3 do plano do ATL-74).
      skipped: skillsExisting + itemsExisting,
    }),
  );

  return {
    ok: true,
    summary: {
      importId,
      subject: { name: content.subject.name, created: state.subjectById === undefined },
      skills: { inserted: skillsInserted, existing: skillsExisting },
      items: { inserted: itemsInserted, existing: itemsExisting },
      warnings: validation.warnings,
    },
  };
}
