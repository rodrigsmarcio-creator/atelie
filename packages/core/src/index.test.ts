import { expect, test } from 'vitest';
import * as core from './index';

// Teste trivial (ATL-61): garante que o pacote carrega e que o Vitest o enxerga.
test('o pacote core carrega', () => {
  expect(core).toBeTypeOf('object');
});
