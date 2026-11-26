import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import type { Db } from '../client';
import { items, materials, programs, skillPrereqs, skills, subjects } from '../schema';
import type { ExistingItem } from './check';
import { citedMaterials } from './material';
import type { ContentFile, NotApplicableDimension } from './schema';

// O que a validação e a gravação precisam saber do banco para um arquivo de
// conteúdo. Só leitura: tudo parametrizado, e só as linhas que o arquivo toca.

export type StateSkill = {
  id: string;
  subjectId: string;
  name: string;
  depth: number;
  notApplicable: readonly NotApplicableDimension[];
};

export type ImportState = {
  // Matéria que já tem o ID do arquivo e matéria que já tem o nome dele.
  subjectById: { id: string; name: string; programId: string | null } | undefined;
  subjectByName: { id: string; name: string } | undefined;
  // Curso que já tem o ID do `program` do arquivo e curso que já tem o nome dele.
  programById: { id: string; name: string } | undefined;
  programByName: { id: string; name: string } | undefined;
  // Ofícios da matéria do arquivo e os que o arquivo cita (ele mesmo, pré-requisito, item).
  skills: ReadonlyMap<string, StateSkill>;
  // Todas as arestas do grafo no banco (um ciclo pode passar por outra matéria).
  edges: readonly { skillId: string; prereqId: string }[];
  // Itens não arquivados dos Ofícios do arquivo e dos que os itens dele citam.
  items: readonly ExistingItem[];
  // Dono de cada item do arquivo que já existe, arquivado ou não.
  itemOwners: ReadonlyMap<string, string>;
  // Materiais citados por ID no arquivo que existem no banco.
  materialIds: ReadonlySet<string>;
  // Materiais citados por nome (nome exato = `path` ou `url`) que já existem, com o ID.
  materialByName: ReadonlyMap<string, string>;
  // `path` e `url` de materiais do banco que só diferem em maiúsculas de algum nome
  // citado (ou são iguais a ele): servem ao aviso de entradas separadas.
  materialKeys: readonly string[];
};

const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

export async function loadImportState(db: Db, file: ContentFile): Promise<ImportState> {
  const fileSkillIds = file.skills.map((skill) => skill.id);
  const itemSkillIds = file.items.map((item) => item.skill_id);
  const referencedSkillIds = unique([
    ...fileSkillIds,
    ...itemSkillIds,
    ...file.skills.flatMap((skill) => skill.prereqs),
  ]);
  const itemSkills = unique([...fileSkillIds, ...itemSkillIds]);
  const fileItemIds = file.items.map((item) => item.id);
  const cited = citedMaterials(file);
  const lowerNames = cited.names.map((name) => name.toLowerCase());

  const subjectRows = await db
    .select({ id: subjects.id, name: subjects.name, programId: subjects.programId })
    .from(subjects)
    .where(or(eq(subjects.id, file.subject.id), eq(subjects.name, file.subject.name)));

  const programRows = file.program
    ? await db
        .select({ id: programs.id, name: programs.name })
        .from(programs)
        .where(or(eq(programs.id, file.program.id), eq(programs.name, file.program.name)))
    : [];

  const skillRows = await db
    .select({
      id: skills.id,
      subjectId: skills.subjectId,
      name: skills.name,
      depth: skills.depth,
      notApplicable: skills.notApplicableJson,
    })
    .from(skills)
    .where(
      or(
        eq(skills.subjectId, file.subject.id),
        referencedSkillIds.length > 0 ? inArray(skills.id, referencedSkillIds) : undefined,
      ),
    );

  const edges = await db
    .select({ skillId: skillPrereqs.skillId, prereqId: skillPrereqs.prereqId })
    .from(skillPrereqs);

  const itemRows =
    itemSkills.length > 0
      ? await db
          .select({
            id: items.id,
            skill_id: items.skillId,
            kind: items.kind,
            dimension: items.dimension,
            evidence: items.evidence,
            category: items.category,
          })
          .from(items)
          .where(and(inArray(items.skillId, itemSkills), isNull(items.archivedAt)))
      : [];

  const ownerRows =
    fileItemIds.length > 0
      ? await db
          .select({ id: items.id, skillId: items.skillId })
          .from(items)
          .where(inArray(items.id, fileItemIds))
      : [];

  // Materiais pelo ID citado e pelo nome citado, sem diferenciar maiúsculas (o
  // `lower` pega também os que só diferem delas, para o aviso).
  const materialRows =
    cited.ids.length > 0 || cited.names.length > 0
      ? await db
          .select({ id: materials.id, path: materials.path, url: materials.url })
          .from(materials)
          .where(
            or(
              cited.ids.length > 0 ? inArray(materials.id, cited.ids) : undefined,
              cited.names.length > 0
                ? inArray(sql`lower(${materials.path})`, lowerNames)
                : undefined,
              cited.names.length > 0
                ? inArray(sql`lower(${materials.url})`, lowerNames)
                : undefined,
            ),
          )
      : [];

  const byName = new Map<string, string>();
  const keys: string[] = [];
  for (const row of materialRows) {
    for (const key of [row.path, row.url]) {
      if (key === null) continue;
      keys.push(key);
      if (cited.names.includes(key)) byName.set(key, row.id);
    }
  }

  return {
    subjectById: subjectRows.find((row) => row.id === file.subject.id),
    subjectByName: subjectRows.find((row) => row.name === file.subject.name),
    programById: programRows.find((row) => row.id === file.program?.id),
    programByName: programRows.find((row) => row.name === file.program?.name),
    skills: new Map(skillRows.map((row) => [row.id, row])),
    edges,
    items: itemRows.map((row) => ({
      ...row,
      dimension: row.dimension ?? null,
      evidence: row.evidence ?? null,
      category: row.category ?? null,
    })),
    itemOwners: new Map(ownerRows.map((row) => [row.id, row.skillId])),
    materialIds: new Set(
      materialRows.filter((row) => cited.ids.includes(row.id)).map((row) => row.id),
    ),
    materialByName: byName,
    materialKeys: unique(keys),
  };
}
