/**
 * Fase 0 de docs/PLAN-KEYS-REPARTIDAS.md: guarda los resultados de hoy para que `congelado.test.ts` compruebe que
 * nada de lo existente cambia. Se ejecuta UNA vez, antes de tocar nada: durante la rama, una diferencia es un fallo,
 * nunca algo que se regenera. `npx tsx scripts/congelar.ts`
 */
import { writeFileSync } from 'node:fs';
import fc from 'fast-check';
import { modelArb } from '../packages/engine/test/arbitraries.ts';
import { calcular, huella, serializar } from '../packages/text/test/congelado/calcular.ts';
import { CARPETA, aleatorios, ejemplos } from '../packages/text/test/congelado/documentos.ts';

const SEMILLA = 20261031;
const N = 300;

const modelos = fc.sample(modelArb, { seed: SEMILLA, numRuns: N });
writeFileSync(new URL('aleatorios.json', CARPETA), JSON.stringify(modelos, null, 1) + '\n');

const deEjemplos = Object.fromEntries(ejemplos().map(([ruta, doc]) => [ruta, JSON.parse(serializar(calcular(doc)))]));
writeFileSync(new URL('esperado-ejemplos.json', CARPETA), JSON.stringify(deEjemplos, null, 1) + '\n');
const deAleatorios = aleatorios().map((doc) => huella(serializar(calcular(doc))));
writeFileSync(new URL('esperado-aleatorios.json', CARPETA), JSON.stringify(deAleatorios, null, 1) + '\n');
console.log(`${Object.keys(deEjemplos).length} ejemplos y ${deAleatorios.length} modelos aleatorios congelados`);
