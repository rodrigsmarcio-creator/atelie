import { expect, test } from 'vitest';
import HomePage from './page';

// Teste trivial (ATL-61): a página inicial é um componente que devolve <main>.
// Sem jsdom nem Testing Library por enquanto; entram com o épico das telas.
test('a página inicial renderiza um <main>', () => {
  expect(HomePage().type).toBe('main');
});
