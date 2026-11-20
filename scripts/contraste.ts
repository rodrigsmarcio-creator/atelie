// Contraste WCAG das três paletas (docs/05-atelie.md). Lê a tabela de tokens do próprio
// doc, para os valores não morarem em dois lugares, e imprime o resultado em Markdown.
// Sai com erro se algum par ficar abaixo de 4,5:1.
// Uso: node scripts/contraste.ts
import { readFileSync } from 'node:fs';

const DOC = new URL('../docs/05-atelie.md', import.meta.url);
const PALETTES = ['E', 'G', 'H'] as const;
type Palette = (typeof PALETTES)[number];
type Tokens = Record<string, string>;

// Mínimo WCAG 2.2 AA para texto normal (1.4.3).
const MIN_TEXT = 4.5;

// [texto, fundo]. Os sete primeiros são os exigidos pelo doc; os quatro últimos são
// tokens que aparecem como texto em telas (acento em seleção, XP, acerto, erro).
const PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['text', 'bg'],
  ['text', 'surface'],
  ['text', 'surface-2'],
  ['muted', 'bg'],
  ['muted', 'surface'],
  ['muted', 'surface-2'],
  ['on-accent', 'accent'],
  ['accent', 'surface-2'],
  ['xp', 'surface-2'],
  ['ok', 'surface-2'],
  ['bad', 'surface-2'],
];

const HEX = /`(#[0-9A-Fa-f]{6})`/g;

function readTokens(markdown: string): Record<Palette, Tokens> {
  const result: Record<Palette, Tokens> = { E: {}, G: {}, H: {} };
  for (const line of markdown.split('\n')) {
    // Linha da tabela: | `token` | uso | E | G | H |
    const row = /^\| `([a-z0-9-]+)` \|/.exec(line);
    if (row?.[1]) {
      const hexes = [...line.matchAll(HEX)].map((m) => m[1]);
      if (hexes.length !== PALETTES.length) continue; // halo e glow são rgba, não entram
      PALETTES.forEach((p, i) => (result[p][row[1] as string] = hexes[i] as string));
    }
    // Linha "Iguais nas três: `ok` `#6FD9A0` (...), `bad` `#FF7B6B` (...)."
    if (line.startsWith('Iguais nas três:')) {
      for (const m of line.matchAll(/`([a-z-]+)` `(#[0-9A-Fa-f]{6})`/g)) {
        for (const p of PALETTES) result[p][m[1] as string] = m[2] as string;
      }
    }
  }
  return result;
}

// Luminância relativa (WCAG 2.2, definição de "relative luminance").
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = Number.parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const tokens = readTokens(readFileSync(DOC, 'utf8'));
const failures: string[] = [];
const fmt = (n: number) => n.toFixed(2).replace('.', ',');

console.log('| Par | E | G | H |');
console.log('|---|---|---|---|');
for (const [fg, bg] of PAIRS) {
  const cells = PALETTES.map((p) => {
    const a = tokens[p][fg];
    const b = tokens[p][bg];
    if (!a || !b) throw new Error(`Token ausente no doc: ${p} ${fg} ou ${bg}`);
    const r = ratio(a, b);
    if (r < MIN_TEXT) failures.push(`${p}: ${fg} sobre ${bg} = ${fmt(r)}`);
    return fmt(r);
  });
  console.log(`| \`${fg}\` sobre \`${bg}\` | ${cells.join(' | ')} |`);
}

if (failures.length > 0) {
  console.error(`\nAbaixo de ${fmt(MIN_TEXT)}:1:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log(`\nTodos os pares ≥ ${fmt(MIN_TEXT)}:1.`);
