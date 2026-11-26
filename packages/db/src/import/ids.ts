import { ulid } from 'ulid';

// Único ponto que gera ULID no pacote (linha de `imports` e, no ATL-136, o
// material criado pela importação). Os testes passam o seu próprio gerador.
export function newId(): string {
  return ulid();
}
