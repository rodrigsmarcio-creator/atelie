import { expect, test } from 'vitest';
import * as db from './index';

// Teste trivial (ATL-61): garante que o pacote carrega e que o Vitest o enxerga.
test('o pacote db carrega', () => {
  expect(db).toBeTypeOf('object');
});
