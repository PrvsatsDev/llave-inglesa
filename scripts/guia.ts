/**
 * Regenera las cifras de la guía (packages/text/src/guia-cifras.ts) con el motor.
 * Uso: npx tsx scripts/guia.ts   (un test falla si están desfasadas)
 */
import { writeFileSync } from 'node:fs';
import { calcularCifras } from '../packages/text/src/guia-cifras-calculo.ts';

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
