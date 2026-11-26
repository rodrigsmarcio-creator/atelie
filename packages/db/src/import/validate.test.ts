import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { baseRows, insertRow, openMigratedDrizzle, type Row } from '../test-db';
import {
  SKILL_A,
  SKILL_B,
  completeFile,
  fullItems,
  id,
  rawItem,
  rawSkill,
  times,
  type Raw,
} from './builders';
import { exampleNotas } from './fixtures';
import { parseImportFile, type ParsedImportFile } from './schema';
import { validateImportFile } from './validate';

type TestDb = Awaited<ReturnType<typeof openMigratedDrizzle>>;

let db: TestDb;
beforeEach(async () => {
  db = await openMigratedDrizzle();
});
afterEach(() => {
  db.$client.close();
});

// O ID da matéria do arquivo completo (o do exemplo mínimo do docs/09).
const SUBJECT_ID = '01JCXAM0000000000000SUBJ01';
const OTHER_SUBJECT_ID = id('SB', 2);

function parse(raw: Raw): ParsedImportFile {
  const result = parseImportFile(raw);
  if (!result.ok) throw new Error(`arquivo inválido no formato: ${JSON.stringify(result.errors)}`);
  return result.file;
}

async function validate(raw: Raw) {
  return validateImportFile(db, parse(raw));
}

// Linhas já no banco, com IDs de 26 caracteres, como se vieram de outra importação.
async function seedSubject(patch: Row = {}) {
  await insertRow(db.$client, 'subjects', {
    ...baseRows.subjects,
    program_id: null,
    id: SUBJECT_ID,
    name: 'Cálculo I',
    ...patch,
  });
}

async function seedSkill(skillId: string, patch: Row = {}) {
  await insertRow(db.$client, 'skills', {
    ...baseRows.skills,
    id: skillId,
    subject_id: SUBJECT_ID,
    name: `Ofício do banco ${skillId.slice(-4)}`,
    ...patch,
  });
}

async function seedEdge(skillId: string, prereqId: string) {
  await insertRow(db.$client, 'skill_prereqs', {
    ...baseRows.skill_prereqs,
    skill_id: skillId,
    prereq_id: prereqId,
  });
}

async function seedItem(itemId: string, skillId: string, patch: Row = {}) {
  await insertRow(db.$client, 'items', {
    ...baseRows.items,
    id: itemId,
    skill_id: skillId,
    ...patch,
  });
}

async function seedMaterial(materialId: string, path: string) {
  await insertRow(db.$client, 'materials', { ...baseRows.materials, id: materialId, path });
}

const messages = (issues: { message: string }[]) => issues.map((i) => i.message);

describe('arquivo completo', () => {
  test('em banco vazio não gera erro nem aviso', async () => {
    expect(await validate(completeFile())).toEqual({ errors: [], warnings: [] });
  });

  test('o que a conferência do arquivo recusa continua recusado (ID repetido)', async () => {
    const file = completeFile({ skills: [rawSkill(1), rawSkill(1, { name: 'Outro' })] });
    const { errors } = await validate(file);
    expect(errors.map((e) => e.path)).toContain('skills[1].id');
  });
});

describe('pré-requisito inexistente (recusa 3)', () => {
  test('ID que não está no arquivo nem no banco', async () => {
    const skills = [rawSkill(1, { prereqs: [id('SK', 99)] })];
    const { errors } = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(errors).toContainEqual({
      path: 'skills[0].prereqs[0]',
      message: expect.stringContaining('não existe no arquivo nem no banco'),
    });
  });

  test('Ofício que só existe no banco vale, inclusive o de outra matéria', async () => {
    await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Álgebra' });
    await seedSkill(id('SK', 50), { subject_id: OTHER_SUBJECT_ID, depth: 5 });
    const skills = [rawSkill(1, { prereqs: [id('SK', 50)] })];
    const result = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(result.errors).toEqual([]);
  });
});

describe('ciclo no grafo (recusa 4)', () => {
  test('dois Ofícios do arquivo que se exigem', async () => {
    const skills = [
      rawSkill(1, { depth: 1, prereqs: [SKILL_B] }),
      rawSkill(2, { depth: 2, prereqs: [SKILL_A] }),
    ];
    const { errors } = await validate(
      completeFile({ skills, items: [...fullItems(SKILL_A), ...fullItems(SKILL_B)] }),
    );
    const ciclo = errors.filter((e) => e.message.includes('ciclo'));
    expect(ciclo).toHaveLength(1);
    expect(ciclo[0]?.path).toBe('skills[0].prereqs');
    expect(ciclo[0]?.message).toContain('Ofício 1');
    expect(ciclo[0]?.message).toContain('Ofício 2');
  });

  test('o Ofício que exige a si mesmo', async () => {
    const skills = [rawSkill(1, { prereqs: [SKILL_A] })];
    const { errors } = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(errors).toContainEqual({
      path: 'skills[0].prereqs',
      message: expect.stringContaining('pré-requisito dele mesmo'),
    });
  });

  test('ciclo que passa por uma aresta que já está no banco', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1', depth: 1 });
    await seedSkill(SKILL_B, { name: 'Ofício 2', depth: 2 });
    await seedEdge(SKILL_B, SKILL_A); // no banco: o 2 exige o 1
    // O arquivo faz o 1 exigir o 2.
    const skills = [rawSkill(1, { depth: 3, prereqs: [SKILL_B] })];
    const { errors } = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(errors.filter((e) => e.message.includes('ciclo'))).toHaveLength(1);
  });

  test('as arestas do Ofício que o arquivo traz substituem as do banco', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1', depth: 1 });
    await seedSkill(SKILL_B, { name: 'Ofício 2', depth: 2 });
    await seedEdge(SKILL_A, SKILL_B); // no banco: o 1 exige o 2
    // O arquivo traz os dois: o 1 passa a não exigir nada e o 2 exige o 1. Sem ciclo.
    const skills = [
      rawSkill(1, { depth: 1, prereqs: [] }),
      rawSkill(2, { depth: 2, prereqs: [SKILL_A] }),
    ];
    const result = await validate(
      completeFile({ skills, items: [...fullItems(SKILL_A), ...fullItems(SKILL_B)] }),
    );
    expect(result.errors).toEqual([]);
  });
});

describe('depth só entre Ofícios da mesma matéria (recusa 5)', () => {
  test('depth igual ao do pré-requisito do arquivo', async () => {
    const skills = [rawSkill(1, { depth: 2 }), rawSkill(2, { depth: 2, prereqs: [SKILL_A] })];
    const { errors } = await validate(
      completeFile({ skills, items: [...fullItems(SKILL_A), ...fullItems(SKILL_B)] }),
    );
    expect(errors).toContainEqual({
      path: 'skills[1].depth',
      message: expect.stringContaining('maior que o do pré-requisito'),
    });
  });

  test('pré-requisito da mesma matéria que está no banco', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1', depth: 3 });
    const skills = [rawSkill(2, { depth: 3, prereqs: [SKILL_A] })];
    const { errors } = await validate(completeFile({ skills, items: fullItems(SKILL_B) }));
    expect(errors.map((e) => e.path)).toContain('skills[0].depth');
  });

  test('pré-requisito de outra matéria não mexe no depth (D-053)', async () => {
    await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Álgebra' });
    await seedSkill(id('SK', 50), { subject_id: OTHER_SUBJECT_ID, depth: 9 });
    const skills = [rawSkill(1, { depth: 1, prereqs: [id('SK', 50)] })];
    const result = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(result.errors).toEqual([]);
  });
});

describe('material_id inexistente (recusa 13)', () => {
  const material = id('MT', 1);

  test('no source do Ofício e no do item', async () => {
    const skills = [rawSkill(1, { source: { material_id: material, page_from: 1, page_to: 2 } })];
    const items = fullItems(SKILL_A);
    items[0] = { ...items[0], source: { material_id: material, page: 3 } };
    const { errors } = await validate(completeFile({ skills, items }));
    expect(errors).toContainEqual({
      path: 'skills[0].source.material_id',
      message: expect.stringContaining('não existe no banco'),
    });
    expect(errors.map((e) => e.path)).toContain('items[0].source.material_id');
  });

  test('material cadastrado vale', async () => {
    await seedMaterial(material, 'apostila.pdf');
    const skills = [rawSkill(1, { source: { material_id: material, page_from: 1, page_to: 2 } })];
    const result = await validate(completeFile({ skills, items: fullItems(SKILL_A) }));
    expect(result.errors).toEqual([]);
  });
});

describe('conflitos com o que já está no banco (recusas 21 a 25)', () => {
  test('21: matéria com o nome de outra matéria', async () => {
    await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Cálculo I' });
    const { errors } = await validate(completeFile());
    expect(errors).toContainEqual({
      path: 'subject.name',
      message: expect.stringContaining('já existe outra matéria'),
    });
  });

  test('21: mesma matéria (mesmo ID e nome) não é conflito', async () => {
    await seedSubject();
    const { errors } = await validate(completeFile());
    expect(errors).toEqual([]);
  });

  test('22: Ofício com o nome de outro Ofício da matéria', async () => {
    await seedSubject();
    await seedSkill(id('SK', 70), { name: 'Ofício 1' });
    const { errors } = await validate(completeFile());
    expect(errors).toContainEqual({
      path: 'skills[0].name',
      message: expect.stringContaining('já tem outro Ofício'),
    });
  });

  test('22: o Ofício que o próprio arquivo renomeia não conflita', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1' });
    // O arquivo renomeia o SK0001 e o SK0002 passa a usar o nome antigo dele.
    const skills = [
      rawSkill(1, { name: 'Nome novo' }),
      rawSkill(2, { name: 'Ofício 1', prereqs: [SKILL_A] }),
    ];
    const result = await validate(
      completeFile({ skills, items: [...fullItems(SKILL_A), ...fullItems(SKILL_B)] }),
    );
    expect(result.errors).toEqual([]);
  });

  test('23: Ofício cujo ID já existe em outra matéria', async () => {
    await seedSubject({ id: OTHER_SUBJECT_ID, name: 'Álgebra' });
    await seedSkill(SKILL_A, { subject_id: OTHER_SUBJECT_ID, name: 'Outro nome' });
    const { errors } = await validate(completeFile());
    expect(errors).toContainEqual({
      path: 'skills[0].id',
      message: expect.stringContaining('de outra matéria'),
    });
  });

  test('24: item cujo ID já existe em outro Ofício', async () => {
    await seedSubject();
    await seedSkill(id('SK', 70), { name: 'Outro' });
    const items = fullItems(SKILL_A);
    const first = items[0] as { id: string };
    await seedItem(first.id, id('SK', 70));
    const { errors } = await validate(completeFile({ items }));
    expect(errors).toContainEqual({
      path: 'items[0].id',
      message: expect.stringContaining('de outro Ofício'),
    });
  });

  test('25: item com skill_id que não existe no arquivo nem no banco', async () => {
    const items = [...fullItems(SKILL_A), rawItem({ skill_id: id('SK', 99) })];
    const { errors } = await validate(completeFile({ items }));
    expect(errors).toContainEqual({
      path: `items[${items.length - 1}].skill_id`,
      message: expect.stringContaining('não existe no arquivo nem no banco'),
    });
  });

  test('25: item de um Ofício que só existe no banco vale', async () => {
    await seedSubject();
    await seedSkill(id('SK', 70), { name: 'Do banco' });
    for (let n = 0; n < 8; n += 1) await seedItem(id('DB', n + 1), id('SK', 70));
    const items = [...fullItems(SKILL_A), rawItem({ skill_id: id('SK', 70) })];
    const { errors } = await validate(completeFile({ skills: [rawSkill(1)], items }));
    expect(errors).toEqual([]);
  });
});

describe('itens que já estão no banco entram na conta (recusa 8 e mínimos)', () => {
  test('2 itens novos + 1 do banco = 3: não é erro', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1' });
    await seedItem(id('DB', 1), SKILL_A);
    const skills = [rawSkill(1)];
    const items = times(2, () => rawItem());
    const { errors } = await validate(completeFile({ skills, items }));
    expect(errors).toEqual([]);
  });

  test('item arquivado no banco não conta', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1' });
    await seedItem(id('DB', 1), SKILL_A);
    for (let n = 2; n <= 6; n += 1) {
      await seedItem(id('DB', n), SKILL_A, { archived_at: '2026-01-02T00:00:00.000Z' });
    }
    const skills = [rawSkill(1)];
    const items = [rawItem()]; // 1 novo + 1 ativo = 2 (os 5 arquivados não contam)
    const { errors } = await validate(completeFile({ skills, items }));
    expect(messages(errors).join('\n')).toContain('ficaria com 2 itens');
  });

  test('o not_applicable que o Ofício já tinha vale quando o arquivo não o traz', async () => {
    await seedSubject();
    await seedSkill(SKILL_A, { name: 'Ofício 1', not_applicable_json: '["fluencia"]' });
    const items = fullItems(SKILL_A).filter((i) => i['dimension'] !== 'fluencia');
    const result = await validate(completeFile({ skills: [rawSkill(1)], items }));
    expect(messages(result.warnings).join('\n')).not.toContain('Fluência');
  });
});

describe('tags (D4)', () => {
  test('aceita, não grava e avisa uma vez só', async () => {
    const items = fullItems(SKILL_A).map((item, i) => (i < 3 ? { ...item, tags: ['a'] } : item));
    const result = await validate(completeFile({ skills: [rawSkill(1)], items }));
    expect(result.errors).toEqual([]);
    const avisos = result.warnings.filter((w) => w.message.includes('tags'));
    expect(avisos).toEqual([
      { path: 'items', message: expect.stringContaining('3 itens com "tags"') },
    ]);
  });
});

describe('arquivo de notas (D5)', () => {
  test('confere o arquivo e avisa que o banco ainda não é conferido', async () => {
    const result = await validateImportFile(db, parse(exampleNotas));
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([
      { path: '', message: expect.stringContaining('ainda não implementada') },
    ]);
  });

  test('o que o arquivo de notas repete continua recusado', async () => {
    const grade = exampleNotas.grades[0];
    const file = { ...exampleNotas, grades: [grade, { ...grade, id: id('GR', 2) }] };
    const { errors } = await validate(file);
    expect(errors.map((e) => e.path)).toContain('grades[1].review_log_id');
  });
});

describe('curso (recusas 14 e 15, ATL-136)', () => {
  const PROGRAM_1 = id('PG', 1);
  const PROGRAM_2 = id('PG', 2);
  const program = (patch: Raw = {}) => ({
    id: PROGRAM_1,
    name: 'Direito',
    reference: 'Direito, USP, grade 2025',
    ...patch,
  });

  async function seedProgram(programId: string, name: string) {
    await insertRow(db.$client, 'programs', { ...baseRows.programs, id: programId, name });
  }

  test('sem program no arquivo, nada é conferido (a ligação do banco fica)', async () => {
    await seedProgram(PROGRAM_1, 'Direito');
    await seedSubject({ program_id: PROGRAM_1 });
    expect((await validate(completeFile())).errors).toEqual([]);
  });

  test('curso novo e matéria nova valem', async () => {
    expect((await validate(completeFile({ program: program() }))).errors).toEqual([]);
  });

  test('14: curso com o nome de outro curso (ID diferente)', async () => {
    await seedProgram(PROGRAM_2, 'Direito');
    const { errors } = await validate(completeFile({ program: program() }));
    expect(errors).toContainEqual({
      path: 'program.name',
      message: expect.stringContaining('já existe outro curso'),
    });
  });

  test('14: mesmo ID reaproveitado, com o mesmo nome ou com nome novo, vale', async () => {
    await seedProgram(PROGRAM_1, 'Direito');
    expect((await validate(completeFile({ program: program() }))).errors).toEqual([]);
    expect(
      (await validate(completeFile({ program: program({ name: 'Direito USP' }) }))).errors,
    ).toEqual([]);
  });

  test('15: matéria já ligada a outro curso', async () => {
    await seedProgram(PROGRAM_2, 'Medicina');
    await seedSubject({ program_id: PROGRAM_2 });
    const { errors } = await validate(completeFile({ program: program() }));
    expect(errors).toContainEqual({
      path: 'program.id',
      message: expect.stringContaining('já está ligada a outro curso'),
    });
  });

  test('15: o mesmo curso, ou matéria sem curso, valem (a ligação é feita)', async () => {
    await seedProgram(PROGRAM_1, 'Direito');
    await seedSubject({ program_id: PROGRAM_1 });
    expect((await validate(completeFile({ program: program() }))).errors).toEqual([]);
  });

  test('15: matéria existente sem curso passa a ter o do arquivo', async () => {
    await seedSubject({ program_id: null });
    expect((await validate(completeFile({ program: program() }))).errors).toEqual([]);
  });
});

describe('material por nome (ATL-136)', () => {
  const MATERIAL = id('MT', 1);
  const withSource = (source: Raw, skillPatch: Raw = {}) =>
    completeFile({
      skills: [rawSkill(1, { source, ...skillPatch }), rawSkill(2, { prereqs: [SKILL_A] })],
    });

  test('citar por nome não exige que o material exista', async () => {
    const result = await validate(
      withSource({ material: 'direito/novo.pdf', page_from: 1, page_to: 3 }),
    );
    expect(result).toEqual({ errors: [], warnings: [] });
  });

  test('13 nas recomendações: material_id inexistente', async () => {
    const study = { recommendations: [{ material_id: MATERIAL, note: 'Ler.' }] };
    const { errors } = await validate(withSource({ material: 'a.pdf' }, { study }));
    expect(errors).toContainEqual({
      path: 'skills[0].study.recommendations[0].material_id',
      message: expect.stringContaining('não existe no banco'),
    });
  });

  test('13 nas recomendações: material_id cadastrado vale', async () => {
    await seedMaterial(MATERIAL, 'apostila.pdf');
    const study = { recommendations: [{ material_id: MATERIAL }] };
    const { errors } = await validate(withSource({ material: 'a.pdf' }, { study }));
    expect(errors).toEqual([]);
  });

  test('dois nomes que só diferem em maiúsculas viram duas entradas e avisam', async () => {
    const study = { recommendations: [{ material: 'calculo.pdf' }] };
    const { errors, warnings } = await validate(withSource({ material: 'Calculo.pdf' }, { study }));
    expect(errors).toEqual([]);
    expect(warnings).toEqual([
      { path: '', message: expect.stringContaining('"Calculo.pdf" e "calculo.pdf"') },
    ]);
  });

  test('o aviso também vê o material que já está no banco', async () => {
    await seedMaterial(MATERIAL, 'Calculo.pdf');
    const { warnings } = await validate(withSource({ material: 'calculo.pdf' }));
    expect(messages(warnings).join('\n')).toContain('"Calculo.pdf" e "calculo.pdf"');
  });

  test('o mesmo nome citado várias vezes não avisa', async () => {
    const study = { recommendations: [{ material: 'a.pdf' }, { material: 'a.pdf' }] };
    const { warnings } = await validate(withSource({ material: 'a.pdf' }, { study }));
    expect(warnings).toEqual([]);
  });
});
