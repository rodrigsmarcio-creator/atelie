import type { Db } from '../client';
import {
  checkContentFile,
  checkGradesFile,
  type CheckIssue,
  type CheckResult,
  type ExistingContext,
} from './check';
import { citedMaterials } from './material';
import type { ContentFile, ParsedImportFile } from './schema';
import { loadImportState, type ImportState } from './state';

// Conferência do arquivo contra o banco (docs/09-schema-importacao.md). Soma o
// que o `check.ts` já confere sozinho (ID repetido, quantidade de itens, avisos)
// com o que só o banco sabe: pré-requisito, ciclo, `depth` e conflitos de ID e
// nome. `validateContent` é pura sobre o estado lido; só `validateImportFile`
// toca no banco, e só para ler.

// Ciclos do grafo (componentes fortemente conectados de Tarjan com mais de um
// Ofício, ou um Ofício que aponta para si).
function findCycles(graph: ReadonlyMap<string, readonly string[]>): string[][] {
  let counter = 0;
  const order = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const cycles: string[][] = [];

  const visit = (node: string): void => {
    const own = counter;
    counter += 1;
    order.set(node, own);
    low.set(node, own);
    stack.push(node);
    onStack.add(node);

    for (const next of graph.get(node) ?? []) {
      if (!order.has(next)) {
        visit(next);
        low.set(node, Math.min(low.get(node) ?? own, low.get(next) ?? own));
      } else if (onStack.has(next)) {
        low.set(node, Math.min(low.get(node) ?? own, order.get(next) ?? own));
      }
    }

    if (low.get(node) !== own) return;
    const component: string[] = [];
    for (let member = stack.pop(); member !== undefined; member = stack.pop()) {
      onStack.delete(member);
      component.push(member);
      if (member === node) break;
    }
    const selfLoop = (graph.get(node) ?? []).includes(node);
    if (component.length > 1 || selfLoop) cycles.push(component);
  };

  for (const node of graph.keys()) {
    if (!order.has(node)) visit(node);
  }
  return cycles;
}

function checkAgainstDatabase(file: ContentFile, state: ImportState): CheckIssue[] {
  const errors: CheckIssue[] = [];
  const fileSkills = new Map(file.skills.map((skill) => [skill.id, skill]));
  const nameOf = (skillId: string) =>
    fileSkills.get(skillId)?.name ?? state.skills.get(skillId)?.name ?? skillId;

  // 21: o nome da matéria é único no banco.
  if (state.subjectByName !== undefined && state.subjectByName.id !== file.subject.id) {
    errors.push({
      path: 'subject.name',
      message: `já existe outra matéria chamada "${file.subject.name}" (ID ${state.subjectByName.id}); use esse ID para acrescentar Ofícios a ela`,
    });
  }

  // 14 e 15: o curso. O nome é único, e a matéria não troca de curso em silêncio.
  if (file.program !== undefined) {
    if (state.programByName !== undefined && state.programByName.id !== file.program.id) {
      errors.push({
        path: 'program.name',
        message: `já existe outro curso chamado "${file.program.name}" (ID ${state.programByName.id}); use esse ID para ligar a matéria a ele`,
      });
    }
    const currentProgram = state.subjectById?.programId;
    if (
      currentProgram !== undefined &&
      currentProgram !== null &&
      currentProgram !== file.program.id
    ) {
      errors.push({
        path: 'program.id',
        message: `a matéria "${file.subject.name}" já está ligada a outro curso (ID ${currentProgram}); nada muda de curso em silêncio`,
      });
    }
  }

  // Ofícios da matéria que o arquivo não traz: ficam como estão e guardam seus nomes.
  const untouchedNames = new Map(
    [...state.skills.values()]
      .filter((skill) => skill.subjectId === file.subject.id && !fileSkills.has(skill.id))
      .map((skill) => [skill.name, skill.id]),
  );

  file.skills.forEach((skill, i) => {
    const existing = state.skills.get(skill.id);
    // 23: um Ofício não troca de matéria em silêncio.
    if (existing !== undefined && existing.subjectId !== file.subject.id) {
      errors.push({
        path: `skills[${i}].id`,
        message: `o ID já é de um Ofício de outra matéria ("${existing.name}")`,
      });
    }
    // 22: o nome é único dentro da matéria.
    const sameName = untouchedNames.get(skill.name);
    if (sameName !== undefined) {
      errors.push({
        path: `skills[${i}].name`,
        message: `a matéria já tem outro Ofício chamado "${skill.name}" (ID ${sameName})`,
      });
    }

    skill.prereqs.forEach((prereqId, j) => {
      const inFile = fileSkills.get(prereqId);
      const inDb = state.skills.get(prereqId);
      // 3: o pré-requisito existe no arquivo ou no banco.
      if (inFile === undefined && inDb === undefined) {
        errors.push({
          path: `skills[${i}].prereqs[${j}]`,
          message: `Ofício ${prereqId} não existe no arquivo nem no banco`,
        });
        return;
      }
      // 5: `depth` só conta entre Ofícios da mesma matéria (D-053). O Ofício que
      // aponta para si é um ciclo, tratado abaixo.
      if (prereqId === skill.id) return;
      const sameSubject = inFile !== undefined || inDb?.subjectId === file.subject.id;
      const prereqDepth = inFile?.depth ?? inDb?.depth;
      if (sameSubject && prereqDepth !== undefined && skill.depth <= prereqDepth) {
        errors.push({
          path: `skills[${i}].depth`,
          message: `depth ${skill.depth} precisa ser maior que o do pré-requisito "${nameOf(prereqId)}" (depth ${prereqDepth})`,
        });
      }
    });

    // 13: o material citado por ID existe (o citado por nome é criado se faltar).
    const sourceId = skill.source?.material_id;
    if (sourceId !== undefined && !state.materialIds.has(sourceId)) {
      errors.push({
        path: `skills[${i}].source.material_id`,
        message: `material ${sourceId} não existe no banco`,
      });
    }
    skill.study?.recommendations?.forEach((recommendation, j) => {
      const recommendedId = recommendation.material_id;
      if (recommendedId !== undefined && !state.materialIds.has(recommendedId)) {
        errors.push({
          path: `skills[${i}].study.recommendations[${j}].material_id`,
          message: `material ${recommendedId} não existe no banco`,
        });
      }
    });
  });

  file.items.forEach((item, i) => {
    // 24: um item não troca de Ofício em silêncio.
    const owner = state.itemOwners.get(item.id);
    if (owner !== undefined && owner !== item.skill_id) {
      errors.push({
        path: `items[${i}].id`,
        message: `o ID já é de um item de outro Ofício (${owner})`,
      });
    }
    // 25: o Ofício do item existe no arquivo ou no banco.
    if (!fileSkills.has(item.skill_id) && !state.skills.has(item.skill_id)) {
      errors.push({
        path: `items[${i}].skill_id`,
        message: `Ofício ${item.skill_id} não existe no arquivo nem no banco`,
      });
    }
    const itemMaterialId = item.source?.material_id;
    if (itemMaterialId !== undefined && !state.materialIds.has(itemMaterialId)) {
      errors.push({
        path: `items[${i}].source.material_id`,
        message: `material ${itemMaterialId} não existe no banco`,
      });
    }
  });

  // 4: ciclo. As arestas dos Ofícios do arquivo substituem as do banco.
  const graph = new Map<string, string[]>();
  const addEdge = (from: string, to: string) => {
    const targets = graph.get(from);
    if (targets === undefined) graph.set(from, [to]);
    else targets.push(to);
  };
  for (const edge of state.edges) {
    if (!fileSkills.has(edge.skillId)) addEdge(edge.skillId, edge.prereqId);
  }
  for (const skill of file.skills) {
    for (const prereqId of skill.prereqs) addEdge(skill.id, prereqId);
  }
  for (const cycle of findCycles(graph)) {
    // Um ciclo só nasce de aresta do arquivo: sem Ofício dele dentro, não é culpa dele.
    const index = file.skills.findIndex((skill) => cycle.includes(skill.id));
    if (index < 0) continue;
    const names = [
      ...file.skills.filter((skill) => cycle.includes(skill.id)).map((skill) => skill.name),
      ...cycle.filter((skillId) => !fileSkills.has(skillId)).map(nameOf),
    ];
    errors.push({
      path: `skills[${index}].prereqs`,
      message:
        cycle.length === 1
          ? `o Ofício "${nameOf(cycle[0] ?? '')}" é pré-requisito dele mesmo`
          : `ciclo no grafo de pré-requisitos entre os Ofícios ${names.map((name) => `"${name}"`).join(', ')}`,
    });
  }

  return errors;
}

// Nomes de material que só diferem em maiúsculas viram entradas separadas (o
// UNIQUE diferencia, D-056): avisa, sem normalizar. Vale para os nomes do
// arquivo e para os materiais que já estão no banco.
function caseCollisionWarnings(file: ContentFile, state: ImportState): CheckIssue[] {
  const groups = new Map<string, Set<string>>();
  for (const name of [...citedMaterials(file).names, ...state.materialKeys]) {
    const key = name.toLowerCase();
    groups.set(key, (groups.get(key) ?? new Set<string>()).add(name));
  }
  return [...groups.values()]
    .filter((names) => names.size > 1)
    .map((names) => ({
      path: '',
      message: `materiais cujo nome só difere em maiúsculas viram entradas separadas: ${[...names]
        .sort()
        .map((name) => `"${name}"`)
        .join(' e ')}`,
    }));
}

export function validateContent(file: ContentFile, state: ImportState): CheckResult {
  const existing: ExistingContext = {
    items: state.items,
    skills: [...state.skills.values()].map((skill) => ({
      id: skill.id,
      not_applicable: skill.notApplicable,
    })),
  };
  const base = checkContentFile(file, existing);
  const warnings = [...base.warnings];

  // O banco não tem coluna para `tags` (docs/04): o campo é aceito e descartado.
  const withTags = file.items.filter((item) => item.tags !== undefined).length;
  if (withTags > 0) {
    warnings.push({
      path: 'items',
      message: `${withTags} ${withTags === 1 ? 'item com "tags"' : 'itens com "tags"'}: o campo não é gravado (o banco não tem coluna para ele)`,
    });
  }

  warnings.push(...caseCollisionWarnings(file, state));

  return { errors: [...base.errors, ...checkAgainstDatabase(file, state)], warnings };
}

// Lê o banco e confere o arquivo, sem gravar nada. Arquivo de notas: confere só o
// arquivo, porque a importação das notas ainda não existe (sem ticket).
export async function validateImportFile(db: Db, file: ParsedImportFile): Promise<CheckResult> {
  if (file.type === 'notas_explicacao') {
    const result = checkGradesFile(file.data);
    return {
      errors: result.errors,
      warnings: [
        ...result.warnings,
        {
          path: '',
          message:
            'a conferência das notas contra o banco (tentativa existente, nota já importada) ainda não existe: importação de notas ainda não implementada',
        },
      ],
    };
  }
  return validateContent(file.data, await loadImportState(db, file.data));
}
