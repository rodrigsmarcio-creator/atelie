import type { ContentFile } from './schema';

// Material citado por nome de arquivo ou link (docs/09, "Materiais por nome";
// D-049, D-056). Funções puras: o que vale como nome, de que tipo é e como se
// chama a entrada que a importação cria na Biblioteca.

export type MaterialKind = 'pdf' | 'markdown' | 'link';

const LINK_PREFIX = /^https?:\/\//i;
const FILE_EXTENSION = /\.(pdf|md)$/i;

export const isLink = (name: string): boolean => LINK_PREFIX.test(name);

// Devolve o motivo de o nome não valer (recusa 12), ou nada se vale. O arquivo é
// relativo a `data/acervo/`, com `/` entre pastas; `..` só conta como pasta
// inteira ("Cap..1.pdf" é um nome válido). A extensão não diferencia maiúsculas
// (D2 do plano do ATL-136); o nome, sim, e é ele que serve de chave.
export function materialProblem(name: string): string | undefined {
  if (name === '') return 'material vazio: informe um nome de arquivo (.pdf ou .md) ou um link';

  if (isLink(name)) {
    if (/\s/.test(name)) return 'o link não pode ter espaço';
    return URL.canParse(name) ? undefined : 'link inválido';
  }

  if (name.includes('\\')) return 'use / entre as pastas e não \\';
  if (name.startsWith('/') || /^[A-Za-z]:/.test(name)) {
    return 'caminho absoluto: o nome é relativo à pasta data/acervo/';
  }
  if (name.toLowerCase().startsWith('data/acervo/')) {
    return 'tire o prefixo data/acervo/: o nome já é relativo a essa pasta';
  }
  for (const segment of name.split('/')) {
    if (segment === '') return 'o caminho tem uma pasta vazia (//)';
    if (segment === '..') return 'não use ".." no caminho';
    if (segment === '.') return 'não use "." no caminho';
  }
  if (!FILE_EXTENSION.test(name)) {
    return 'extensão não aceita: use .pdf ou .md (ou um link http/https)';
  }
  if (materialTitle(name) === '') return 'o arquivo precisa ter nome antes da extensão';
  return undefined;
}

// Tipo da entrada criada: .pdf, .md ou link. Só vale para nome que passou em
// `materialProblem`.
export function materialKind(name: string): MaterialKind {
  if (isLink(name)) return 'link';
  return name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'markdown';
}

// Título da entrada (D1 do plano do ATL-136): o nome do arquivo sem a pasta e
// sem a extensão; no link, o próprio link.
export function materialTitle(name: string): string {
  if (isLink(name)) return name;
  const file = name.slice(name.lastIndexOf('/') + 1);
  return file.replace(FILE_EXTENSION, '');
}

type MaterialRef = { material_id?: string | undefined; material?: string | undefined };

// Todo lugar do arquivo que cita material: o source do Ofício, as recomendações
// do estudo e o source dos itens.
export function materialRefs(file: ContentFile): MaterialRef[] {
  return [
    ...file.skills.flatMap((skill) => [
      ...(skill.source ? [skill.source] : []),
      ...(skill.study?.recommendations ?? []),
    ]),
    ...file.items.flatMap((item) => (item.source ? [item.source] : [])),
  ];
}

// IDs e nomes citados, sem repetição e na ordem em que aparecem.
export function citedMaterials(file: ContentFile): { ids: string[]; names: string[] } {
  const refs = materialRefs(file);
  const unique = (values: string[]) => [...new Set(values)];
  return {
    ids: unique(refs.flatMap((ref) => (ref.material_id === undefined ? [] : [ref.material_id]))),
    names: unique(refs.flatMap((ref) => (ref.material === undefined ? [] : [ref.material]))),
  };
}
