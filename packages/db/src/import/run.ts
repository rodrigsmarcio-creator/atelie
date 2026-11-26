import { inArray, sql } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import type { Db } from '../client';
import {
  imports,
  items,
  materials,
  materialSkills,
  programs,
  skillPrereqs,
  skills,
  subjects,
} from '../schema';
import type { CheckIssue } from './check';
import { newId } from './ids';
import { citedMaterials, materialKind, materialTitle } from './material';
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
  // Só quando o arquivo traz `program`.
  program?: { name: string; created: boolean };
  skills: { inserted: number; existing: number };
  items: { inserted: number; existing: number };
  // Entradas novas na Biblioteca, criadas por material citado por nome ou link.
  materials: { created: number };
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
type ImportRow = typeof imports.$inferInsert;
type MaterialRef = { material_id?: string | undefined; material?: string | undefined };

// Material que a importação cria na Biblioteca: citado por nome ou link e ainda
// sem entrada. O nome exato é a chave (`path` ou `url`).
type NewMaterial = { id: string; name: string };

function buildStatements(
  db: Db,
  file: ContentFile,
  now: string,
  importRow: ImportRow,
  newMaterials: readonly NewMaterial[],
  materialIdByName: ReadonlyMap<string, string>,
): Batch {
  const { subject, program } = file;

  // Depois da conferência todo material citado tem ID: o `material_id` do
  // arquivo, o que já existia pelo nome ou o que vai ser criado aqui.
  const materialIdOf = (ref: MaterialRef): string => {
    const found =
      ref.material_id ??
      (ref.material === undefined ? undefined : materialIdByName.get(ref.material));
    if (found === undefined) throw new Error('material sem ID depois da conferência do arquivo');
    return found;
  };

  const batch: Batch = [
    db
      .insert(subjects)
      .values({
        id: subject.id,
        name: subject.name,
        programId: program?.id ?? null,
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
          // Sem `program`, a matéria mantém o curso que já tinha.
          ...defined({
            programId: program?.id,
            shortName: subject.short_name,
            weight: subject.weight,
            examAt: subject.exam_at,
          }),
        },
      }),
  ];

  // O curso vem antes da matéria (FK). `archived_at` é da tela, não da importação.
  if (program !== undefined) {
    batch.unshift(
      db
        .insert(programs)
        .values({
          id: program.id,
          name: program.name,
          reference: program.reference,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: programs.id,
          set: { name: program.name, reference: program.reference, updatedAt: now },
        }),
    );
  }

  // Os materiais vêm antes dos Ofícios e itens que os citam (FK).
  for (const material of newMaterials) {
    const kind = materialKind(material.name);
    batch.push(
      db.insert(materials).values({
        id: material.id,
        kind,
        title: materialTitle(material.name),
        path: kind === 'link' ? null : material.name,
        url: kind === 'link' ? material.name : null,
        createdAt: now,
        updatedAt: now,
      }),
    );
  }

  for (const skill of file.skills) {
    const sourceMaterialId = skill.source ? materialIdOf(skill.source) : undefined;
    const study = skill.study;
    // As recomendações guardam o ID do material, resolvido a partir do nome.
    const recommendations = study?.recommendations?.map((recommendation) => ({
      material_id: materialIdOf(recommendation),
      ...defined({
        page_from: recommendation.page_from,
        page_to: recommendation.page_to,
        note: recommendation.note,
      }),
    }));
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
          sourceMaterialId: sourceMaterialId ?? null,
          notApplicableJson: skill.not_applicable ?? [],
          studyExplanation: study?.explanation ?? null,
          studyRecommendationsJson: recommendations ?? null,
          studyGuidance: study?.guidance ?? null,
          studyFaqJson: study?.faq ?? null,
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
              sourceMaterialId,
              notApplicableJson: skill.not_applicable,
              // Campo omitido, ou study omitido, não apaga o texto que já existe.
              studyExplanation: study?.explanation,
              studyRecommendationsJson: recommendations,
              studyGuidance: study?.guidance,
              studyFaqJson: study?.faq,
            }),
          },
        }),
    );
    if (skill.source !== undefined && sourceMaterialId !== undefined) {
      const pages = defined({ pageFrom: skill.source.page_from, pageTo: skill.source.page_to });
      const insert = db.insert(materialSkills).values({
        materialId: sourceMaterialId,
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
    const sourceMaterialId = item.source ? materialIdOf(item.source) : undefined;
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
          sourceMaterialId: sourceMaterialId ?? null,
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
              sourceMaterialId,
              sourcePage: item.source?.page,
            }),
          },
        }),
    );
  }

  batch.push(db.insert(imports).values(importRow));
  return batch;
}

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
  const generateId = context.newId ?? newId;

  // Cada nome citado vira um material: o que já existe pelo `path` ou `url`, ou
  // um novo, com ULID. Os IDs dos materiais saem antes do ID da importação.
  const materialIdByName = new Map(state.materialByName);
  const newMaterials: NewMaterial[] = [];
  for (const name of citedMaterials(content).names) {
    if (materialIdByName.has(name)) continue;
    const materialId = generateId();
    materialIdByName.set(name, materialId);
    newMaterials.push({ id: materialId, name });
  }
  const importId = generateId();

  const skillsExisting = content.skills.filter((skill) => state.skills.has(skill.id)).length;
  const itemsExisting = content.items.filter((item) => state.itemOwners.has(item.id)).length;
  const skillsInserted = content.skills.length - skillsExisting;
  const itemsInserted = content.items.length - itemsExisting;

  // Um lote só: o libsql roda tudo numa transação e desfaz tudo se um comando
  // falhar. As leituras acima já conferiram o arquivo; a transação é só para a
  // gravação (um único usuário, sem outra importação ao mesmo tempo).
  await db.batch(
    buildStatements(
      db,
      content,
      now,
      {
        id: importId,
        kind: 'conteudo',
        fileName: context.fileName,
        fileHash: context.fileHash,
        ranAt: now,
        skillsInserted,
        itemsInserted,
        gradesInserted: 0,
        // "Pulados" são os que já existiam, atualizados ou idênticos (D-066).
        skipped: skillsExisting + itemsExisting,
      },
      newMaterials,
      materialIdByName,
    ),
  );

  return {
    ok: true,
    summary: {
      importId,
      subject: { name: content.subject.name, created: state.subjectById === undefined },
      ...(content.program === undefined
        ? {}
        : { program: { name: content.program.name, created: state.programById === undefined } }),
      skills: { inserted: skillsInserted, existing: skillsExisting },
      items: { inserted: itemsInserted, existing: itemsExisting },
      materials: { created: newMaterials.length },
      warnings: validation.warnings,
    },
  };
}
