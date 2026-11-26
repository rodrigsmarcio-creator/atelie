import { describe, expect, test } from 'vitest';
import { materialKind, materialProblem, materialTitle } from './material';

describe('materialProblem: nomes que valem', () => {
  test.each([
    'Stewart - Calculo vol 1.pdf',
    'direito/constituicao.md',
    'direito/Lenza - Direito Constitucional.pdf',
    'a/b/c.pdf',
    'Cap..1.pdf', // ".." dentro do nome não é subir de pasta
    'Apostila.PDF', // extensão sem diferenciar maiúsculas (D2)
    'notas.Md',
    'https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm',
    'http://exemplo.org/a?b=c#d',
    'HTTPS://exemplo.org',
  ])('aceita %s', (name) => {
    expect(materialProblem(name)).toBeUndefined();
  });
});

describe('materialProblem: nomes que não valem (recusa 12)', () => {
  test.each([
    ['', 'vazio'],
    ['livro', 'extensão'],
    ['livro.txt', 'extensão'],
    ['livro.docx', 'extensão'],
    ['.pdf', 'nome'],
    ['../livro.pdf', '".."'],
    ['a/../livro.pdf', '".."'],
    ['a/./livro.pdf', '"."'],
    ['a//livro.pdf', 'vazia'],
    ['/livro.pdf', 'absoluto'],
    ['C:/livro.pdf', 'absoluto'],
    ['c:livro.pdf', 'absoluto'],
    ['C:\\livro.pdf', '\\'],
    ['direito\\livro.pdf', '\\'],
    ['data/acervo/livro.pdf', 'data/acervo/'],
    ['DATA/ACERVO/livro.pdf', 'data/acervo/'],
    ['ftp://exemplo.org/livro.pdf', 'vazia'],
    ['https://exemplo .org/a', 'espaço'],
    ['https://', 'link'],
    ['http://', 'link'],
  ])('recusa %j', (name, text) => {
    expect(materialProblem(name)).toContain(text);
  });
});

describe('materialKind', () => {
  test.each([
    ['livro.pdf', 'pdf'],
    ['direito/livro.PDF', 'pdf'],
    ['notas.md', 'markdown'],
    ['notas.MD', 'markdown'],
    ['https://exemplo.org/livro.pdf', 'link'], // link para PDF continua sendo link
    ['http://exemplo.org', 'link'],
  ])('%s é %s', (name, kind) => {
    expect(materialKind(name)).toBe(kind);
  });
});

describe('materialTitle (D1)', () => {
  test.each([
    ['Stewart - Calculo vol 1.pdf', 'Stewart - Calculo vol 1'],
    ['direito/Lenza - Direito Constitucional.pdf', 'Lenza - Direito Constitucional'],
    ['a/b/notas.MD', 'notas'],
    ['Cap..1.pdf', 'Cap..1'],
    ['relatorio.final.pdf', 'relatorio.final'],
    ['https://exemplo.org/livro.pdf', 'https://exemplo.org/livro.pdf'],
  ])('%s vira %s', (name, title) => {
    expect(materialTitle(name)).toBe(title);
  });
});
