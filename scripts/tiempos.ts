/**
 * Tiempo de `analyze()` en cada ejemplo (mediana de varias vueltas, en ms). Sirve para comparar antes y después de
 * un cambio del motor (docs/PLAN-KEYS-REPARTIDAS.md, 2.1). `npx tsx scripts/tiempos.ts`
 */
import { parseModel } from '@llave-inglesa/domain';
import { analyze } from '@llave-inglesa/engine';
import { ejemplos } from '../packages/text/test/congelado/documentos.ts';

const VUELTAS = 15;
let total = 0;
for (const [ruta, doc] of ejemplos()) {
  const r = parseModel(doc);
  if (!r.ok) throw new Error(ruta);
  analyze(r.model); // calentar
  const ms: number[] = [];
  for (let i = 0; i < VUELTAS; i++) {
    const t = performance.now();
    analyze(r.model);
    ms.push(performance.now() - t);
  }
  const mediana = ms.sort((a, b) => a - b)[Math.floor(VUELTAS / 2)]!;
  total += mediana;
  console.log(`${mediana.toFixed(1).padStart(8)}  ${ruta}`);
}
console.log(`${total.toFixed(1).padStart(8)}  total`);
