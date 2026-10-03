/**
 * Regenera, con el motor, las cifras de la guía (packages/text/src/guia-cifras.ts) y la guía en
 * Markdown (docs/GUIA.md). Uso: npx tsx scripts/guia.ts   (los tests fallan si están desfasadas)
 */
import { writeFileSync } from 'node:fs';
import { calcularCifras, nombresDeEjemplos } from '../packages/text/src/guia-cifras-calculo.ts';

const cifras = calcularCifras();
const cuerpo = Object.entries(cifras)
  .map(([id, c]) => `  '${id}': { security: ${c.security}, resilience: ${c.resilience}, usability: ${c.usability}, inheritance: ${c.inheritance} },`)
  .join('\n');
writeFileSync(
  new URL('../packages/text/src/guia-cifras.ts', import.meta.url),
  `import type { Metrica } from './guia.ts';

/** Generado por scripts/guia.ts con el motor: puntuaciones de cada ejemplo que cita la guía. No editar a mano. */
export const CIFRAS: Record<string, Record<Metrica, number>> = {
${cuerpo}
};
`,
);
console.log('packages/text/src/guia-cifras.ts');

// Después de escribir las cifras: el Markdown las lee.
const { guiaMarkdown } = await import('../packages/text/src/guia-markdown.ts');
writeFileSync(new URL('../docs/GUIA.md', import.meta.url), guiaMarkdown(nombresDeEjemplos()));
console.log('docs/GUIA.md');
